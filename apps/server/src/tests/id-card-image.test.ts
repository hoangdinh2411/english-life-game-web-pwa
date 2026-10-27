import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { BadRequestException } from '@nestjs/common';
import { IdCardImageService } from '../modules/id-card/id-card-image.service';

const service = new IdCardImageService();

test('T36.d accepts JPEG, PNG and WebP content, rotates, crops and strips metadata', async () => {
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    const source = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#c08040' } })
      .withMetadata({ orientation: 6 }).toFormat(format).toBuffer();
    const output = await service.process({ buffer: source, size: source.length });
    assert.ok(output);
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, 'jpeg');
    assert.equal(metadata.width, 300);
    assert.equal(metadata.height, 400);
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    assert.equal(metadata.xmp, undefined);
  }
});

test('T36.d rejects renamed/unsupported, oversized and excessive-pixel images', async () => {
  const gif = Buffer.from('47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b', 'hex');
  await assert.rejects(service.process({ buffer: gif, size: gif.length }), BadRequestException);
  await assert.rejects(service.process({ buffer: Buffer.alloc(5 * 1024 * 1024 + 1), size: 5 * 1024 * 1024 + 1 }), BadRequestException);
  const huge = await sharp({ create: { width: 6500, height: 6500, channels: 3, background: '#ffffff' } }).png().toBuffer();
  await assert.rejects(service.process({ buffer: huge, size: huge.length }), BadRequestException);
});

