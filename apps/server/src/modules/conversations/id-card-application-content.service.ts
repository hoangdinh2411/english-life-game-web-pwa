import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { idCardApplicationContentSchema, type IdCardApplicationContent } from '@life-abroad/shared';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

@Injectable()
export class IdCardApplicationContentService {
  private content?: Promise<IdCardApplicationContent>;

  get(): Promise<IdCardApplicationContent> {
    this.content ??= this.load();
    return this.content;
  }

  private async load(): Promise<IdCardApplicationContent> {
    try {
      const path = resolve(__dirname, '../../../../../content/id-card/application.json');
      return idCardApplicationContentSchema.parse(JSON.parse(await readFile(path, 'utf8')) as unknown);
    } catch {
      throw new ServiceUnavailableException('ID card application content is unavailable.');
    }
  }
}

