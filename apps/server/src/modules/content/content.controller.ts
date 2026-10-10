import { Body, Controller, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { assetIdSchema, assetUploadSchema, type AssetUpload } from '@life-abroad/shared';
import { SchemaValidationPipe } from '../../common/pipes/schema-validation.pipe';
import { ContentService, type AssetFile } from './content.service';
import { ServiceKeyGuard } from './service-key.guard';

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}
  @Post('assets/upload')
  @UseGuards(ServiceKeyGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20971520, files: 1, fields: 4, parts: 5 } }))
  upload(@Body(new SchemaValidationPipe(assetUploadSchema)) body: AssetUpload, @UploadedFile() file: AssetFile | undefined) {
    return this.content.upload(body, file);
  }
  @Get('maps/:mapId')
  map(@Param('mapId', new SchemaValidationPipe(assetIdSchema)) mapId: string) { return this.content.map(mapId); }
}
