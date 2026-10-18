import { inflateSync } from 'node:zlib';

export function decodeRgbaPng(buffer) {
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
    const pa = Math.abs(estimate - a), pb = Math.abs(estimate - b), pc = Math.abs(estimate - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
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

export function alphaBounds(image, left, top, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (image.data[((top + y) * image.width + left + x) * 4 + 3] < 16) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < 0) throw new Error('Cell contains no visible pixels');
  return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
