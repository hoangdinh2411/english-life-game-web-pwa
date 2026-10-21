import { Body, Controller, HttpException, Post, Res, UseGuards } from '@nestjs/common';
import { chatStreamRequestSchema, type ChatStreamRequest } from '@life-abroad/shared';
import type { ServerResponse } from 'node:http';
import { SchemaValidationPipe } from '../../common/pipes/schema-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatStreamService, type ChatEvent } from './chat-stream.service';

function writeEvent(response: ServerResponse, event: ChatEvent | { event: 'error'; data: { message: string } }): void {
  response.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
}

export function chatErrorMessage(error: unknown): string {
  if (!(error instanceof HttpException) || error.getStatus() >= 500) return 'Chat is unavailable right now.';
  const response: unknown = error.getResponse();
  if (typeof response === 'string') return response;
  if (typeof response === 'object' && response !== null && 'message' in response && typeof response.message === 'string') {
    return response.message;
  }
  return error.message;
}

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatStreamService) {}

  @Post('stream')
  async stream(@CurrentUser() userId: string,
    @Body(new SchemaValidationPipe(chatStreamRequestSchema)) body: ChatStreamRequest,
    @Res() response: ServerResponse): Promise<void> {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    const cancellation = new AbortController();
    const disconnected = (): void => cancellation.abort(new Error('Client disconnected.'));
    response.once('close', disconnected);
    try {
      await this.chat.stream(userId, body, event => writeEvent(response, event), cancellation.signal);
    } catch (error: unknown) {
      if (!cancellation.signal.aborted) writeEvent(response, { event: 'error', data: { message: chatErrorMessage(error) } });
    } finally {
      response.removeListener('close', disconnected);
      if (!response.writableEnded) response.end();
    }
  }
}
