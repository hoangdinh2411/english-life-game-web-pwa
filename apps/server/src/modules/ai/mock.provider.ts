import { AiProvider, AiReplyRequest } from './ai-provider';

export class MockProvider implements AiProvider {
  async reply(_request: AiReplyRequest, signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    return 'Hello! What would you like to talk about today?';
  }
}
