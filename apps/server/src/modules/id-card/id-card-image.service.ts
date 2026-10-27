import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

@Injectable()
export class IdCardImageService {
  async process(file: { buffer: Buffer; size: number } | undefined): Promise<Buffer | null> {
    if (!file) return null;
    if (file.size < 1 || file.size > MAX_INPUT_BYTES) throw new BadRequestException('Photo must be no larger than 5 MB.');
    try {
      const image = sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS, animated: false, failOn: 'warning' });
      const metadata = await image.metadata();
      if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
        throw new BadRequestException('Photo must be a JPEG, PNG or WebP image.');
      }
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_INPUT_PIXELS) {
        throw new BadRequestException('Photo dimensions are too large.');
      }
      return await image.rotate().resize(300, 400, { fit: 'cover', position: 'centre' }).jpeg({ quality: 85 }).toBuffer();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Photo must be a valid JPEG, PNG or WebP image within the size limits.');
    }
  }
}

