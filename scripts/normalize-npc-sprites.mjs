import { Buffer } from 'node:buffer';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const SOURCE_COLUMNS = 4;
const SOURCE_ROWS = 4;
const SOURCE_FRAME_WIDTH = 96;
const SOURCE_FRAME_HEIGHT = 171;
const SOURCE_CENTER_X = (SOURCE_FRAME_WIDTH - 1) / 2;
const FRAME_WIDTH = 128;
const FRAME_HEIGHT = 192;
const VISIBLE_HEIGHT = 156;
const CENTER_X = (FRAME_WIDTH - 1) / 2;
const BASELINE_Y = 184;

function decodeRgbaPng(buffer) {
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (buffer[24] !== 8 || buffer[25] !== 6) throw new Error('Expected an 8-bit RGBA PNG');
  const chunks = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const encoded = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const data = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const estimate = a + b - c;
    const distances = [Math.abs(estimate - a), Math.abs(estimate - b), Math.abs(estimate - c)];
    return distances[0] <= distances[1] && distances[0] <= distances[2] ? a : distances[1] <= distances[2] ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = encoded[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const raw = encoded[y * (stride + 1) + x + 1];
      const left = x >= 4 ? data[y * stride + x - 4] : 0;
      const above = y > 0 ? data[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? data[(y - 1) * stride + x - 4] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above
        : filter === 3 ? Math.floor((left + above) / 2) : filter === 4 ? paeth(left, above, upperLeft)
          : (() => { throw new Error(`Unsupported PNG filter ${filter}`); })();
      data[y * stride + x] = (raw + predictor) & 255;
    }
  }
  return { width, height, data };
}

function visibleBounds(image, column, row) {
  let top = SOURCE_FRAME_HEIGHT;
  let bottom = -1;
  for (let y = 0; y < SOURCE_FRAME_HEIGHT; y += 1) for (let x = 0; x < SOURCE_FRAME_WIDTH; x += 1) {
    const alpha = image.data[((row * SOURCE_FRAME_HEIGHT + y) * image.width + column * SOURCE_FRAME_WIDTH + x) * 4 + 3];
    if (alpha < 16) continue;
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  if (bottom < 0) throw new Error(`Frame ${column},${row} contains no visible pixels`);
  return { bottom, height: bottom - top + 1 };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}

function normalizeSheet(image) {
  if (image.width !== SOURCE_FRAME_WIDTH * SOURCE_COLUMNS || image.height !== SOURCE_FRAME_HEIGHT * SOURCE_ROWS) {
    throw new Error(`Expected a ${SOURCE_FRAME_WIDTH * SOURCE_COLUMNS}x${SOURCE_FRAME_HEIGHT * SOURCE_ROWS} source sheet`);
  }
  const rowMetrics = Array.from({ length: SOURCE_ROWS }, (_, row) => {
    const bounds = Array.from({ length: SOURCE_COLUMNS }, (_, column) => visibleBounds(image, column, row));
    return { scale: VISIBLE_HEIGHT / median(bounds.map(value => value.height)), baseline: median(bounds.map(value => value.bottom)) };
  });
  const width = FRAME_WIDTH * SOURCE_COLUMNS;
  const height = FRAME_HEIGHT * SOURCE_ROWS;
  const data = Buffer.alloc(width * height * 4);
  for (let row = 0; row < SOURCE_ROWS; row += 1) for (let column = 0; column < SOURCE_COLUMNS; column += 1) {
    const sourceRow = row === 2 ? 1 : row;
    const { scale, baseline } = rowMetrics[sourceRow];
    for (let y = 0; y < FRAME_HEIGHT; y += 1) for (let x = 0; x < FRAME_WIDTH; x += 1) {
      const sampleX = row === 2 ? FRAME_WIDTH - 1 - x : x;
      const sourceX = Math.round((sampleX - CENTER_X) / scale + SOURCE_CENTER_X);
      const sourceY = Math.round((y - BASELINE_Y) / scale + baseline);
      if (sourceX < 0 || sourceX >= SOURCE_FRAME_WIDTH || sourceY < 0 || sourceY >= SOURCE_FRAME_HEIGHT) continue;
      const sourceOffset = (((sourceRow * SOURCE_FRAME_HEIGHT + sourceY) * image.width) + column * SOURCE_FRAME_WIDTH + sourceX) * 4;
      const targetOffset = (((row * FRAME_HEIGHT + y) * width) + column * FRAME_WIDTH + x) * 4;
      image.data.copy(data, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return { width, height, data };
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return chunk;
}

function encodeRgbaPng(image) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = image.width * 4;
  const scanlines = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) image.data.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(scanlines, { level: 9 })), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function writeFileWithRetry(path, data) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await writeFile(path, data);
      return;
    } catch (error) {
      if (error.code !== 'UNKNOWN' || attempt === 4) throw error;
      await delay(50 * (attempt + 1));
    }
  }
}

const assetRoot = fileURLToPath(new URL('../apps/game/assets/npcs/', import.meta.url));
for (const directory of await readdir(assetRoot)) {
  const path = join(assetRoot, directory, 'walk.png');
  try {
    const source = decodeRgbaPng(await readFile(path));
    if (source.width === FRAME_WIDTH * SOURCE_COLUMNS && source.height === FRAME_HEIGHT * SOURCE_ROWS) continue;
    await writeFileWithRetry(path, encodeRgbaPng(normalizeSheet(source)));
    console.log(`Normalized ${directory}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
