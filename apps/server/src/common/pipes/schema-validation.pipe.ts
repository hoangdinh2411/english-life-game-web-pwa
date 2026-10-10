import { BadRequestException, type PipeTransform } from '@nestjs/common';

interface RequestSchema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

export class SchemaValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: RequestSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException('Invalid request');
    return result.data;
  }
}
