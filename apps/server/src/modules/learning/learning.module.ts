import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';

@Module({ imports: [AuthModule, ConversationsModule], controllers: [LearningController], providers: [LearningService] })
export class LearningModule {}
