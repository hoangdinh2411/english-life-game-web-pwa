import { LifeModule } from '../life/life.module';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DialogueModule } from '../dialogue/dialogue.module';
import { QuestsModule } from '../quests/quests.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsRepository } from './conversations.repository';
import { ConversationsService } from './conversations.service';
import { SellerService } from './seller.service';

@Module({ imports: [DatabaseModule, AuthModule, DialogueModule, QuestsModule, LifeModule],
  controllers: [ConversationsController], providers: [ConversationsRepository, ConversationsService, SellerService] })
export class ConversationsModule {}
