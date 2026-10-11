import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Conversation, ConversationTurn, conversationIdSchema, createConversationSchema, SendMessageRequest, sendMessageSchema } from '@life-abroad/shared';
import { SchemaValidationPipe } from '../../common/pipes/schema-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  create(@CurrentUser() userId: string,
    @Body(new SchemaValidationPipe(createConversationSchema)) request: { npcId: string }): Promise<Conversation> {
    return this.conversations.create(userId, request.npcId);
  }

  @Get(':id')
  get(@CurrentUser() userId: string,
    @Param('id', new SchemaValidationPipe(conversationIdSchema)) id: string): Promise<Conversation> {
    return this.conversations.get(userId, id);
  }

  @Post(':id/messages')
  send(@CurrentUser() userId: string,
    @Param('id', new SchemaValidationPipe(conversationIdSchema)) id: string,
    @Body(new SchemaValidationPipe(sendMessageSchema)) request: SendMessageRequest): Promise<ConversationTurn> {
    return this.conversations.send(userId, id, request);
  }
}
