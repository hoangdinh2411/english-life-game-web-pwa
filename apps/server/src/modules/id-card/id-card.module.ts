import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { IdCardController } from './id-card.controller';
import { IdCardImageService } from './id-card-image.service';
import { SupabaseIdCardPhotoStorage } from './id-card-photo.storage';
import { IdCardService } from './id-card.service';
import { IdCardApplicationContentService } from '../conversations/id-card-application-content.service';

@Module({ imports: [DatabaseModule, AuthModule], controllers: [IdCardController],
  providers: [IdCardApplicationContentService, IdCardImageService, SupabaseIdCardPhotoStorage, IdCardService] })
export class IdCardModule {}

