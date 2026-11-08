import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { IdCardController } from './id-card.controller';
import { IdCardImageService } from './id-card-image.service';
import { SupabaseIdCardPhotoStorage } from './id-card-photo.storage';
import { IdCardService } from './id-card.service';
import { IdCardApplicationContentService } from '../conversations/id-card-application-content.service';
import { SpeechModule } from '../speech/speech.module';

@Module({ imports: [DatabaseModule, AuthModule, SpeechModule], controllers: [IdCardController],
  providers: [IdCardApplicationContentService, IdCardImageService, SupabaseIdCardPhotoStorage, IdCardService] })
export class IdCardModule {}

