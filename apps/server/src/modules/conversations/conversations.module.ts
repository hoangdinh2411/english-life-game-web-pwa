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
import { AiModule } from '../ai/ai.module';
import { ChatController } from './chat.controller';
import { ChatStreamService } from './chat-stream.service';
import { SpeechModule } from '../speech/speech.module';
import { NpcsModule } from '../npcs/npcs.module';
import { ConversationReplyService } from './conversation-reply.service';
import { ConversationReplyEnrichmentService } from './conversation-reply-enrichment.service';
import { ConversationScriptedReplyService } from './conversation-scripted-reply.service';

@Module({ imports: [DatabaseModule, AuthModule, DialogueModule, QuestsModule, LifeModule, AiModule, SpeechModule, NpcsModule],
  controllers: [ConversationsController, ChatController],
  providers: [ConversationsRepository, ConversationsService, ConversationReplyService,
    ConversationScriptedReplyService, ConversationReplyEnrichmentService, SellerService, ChatStreamService],
  exports: [ConversationsService] })
export class ConversationsModule {}
