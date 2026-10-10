import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ServiceKeyGuard } from './service-key.guard';
import { DatabaseModule } from '../../infrastructure/database/database.module';

@Module({ imports: [DatabaseModule], controllers: [ContentController], providers: [ContentService, ServiceKeyGuard] })
export class ContentModule {}
