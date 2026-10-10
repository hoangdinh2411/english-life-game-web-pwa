import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { DialogueCacheService } from '../../infrastructure/content/dialogue-cache.service';
import { DialogueService } from './dialogue.service';

@Module({
  imports: [DatabaseModule],
  providers: [DialogueCacheService, DialogueService],
  exports: [DialogueService],
})
export class DialogueModule {}
