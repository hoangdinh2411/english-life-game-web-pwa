import { createHash } from 'node:crypto';
import {
  detectIntent,
  farewellClosing,
  isDirectQuestion,
  type ConversationMessage,
} from '@life-abroad/shared';

export function openingMessageId(conversationId: string): string {
  const bytes = createHash('sha256')
    .update(`opening-message:${conversationId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function transientOpening(
  conversationId: string,
  text: string,
): ConversationMessage {
  return {
    id: openingMessageId(conversationId),
    sender: 'npc',
    text,
    createdAt: new Date().toISOString(),
  };
}

export interface FarewellPolicyResult {
  currentIsGoodbye: boolean;
  response?: {
    text: string;
    stage: 'question' | 'confirm';
  };
}

export function evaluateFarewell(
  history: readonly ConversationMessage[],
  currentText: string,
): FarewellPolicyResult {
  let priorGoodbyes = 0;
  let lastGoodbyeIndex = -1;
  let priorNpcIndex = -1;
  let priorNpcMessage: ConversationMessage | undefined;

  for (const [index, message] of history.entries()) {
    if (
      message.sender === 'player' &&
      detectIntent(message.text)?.id === 'goodbye'
    ) {
      priorGoodbyes += 1;
      lastGoodbyeIndex = index;
    }
    if (message.sender === 'npc') {
      priorNpcIndex = index;
      priorNpcMessage = message;
    }
  }

  const currentIsGoodbye = detectIntent(currentText)?.id === 'goodbye';
  const answeringFarewellQuestion =
    priorGoodbyes > 0 &&
    priorNpcIndex > lastGoodbyeIndex &&
    priorNpcMessage !== undefined &&
    isDirectQuestion(priorNpcMessage.text);

  if (currentIsGoodbye && priorGoodbyes === 0) {
    return {
      currentIsGoodbye,
      response: {
        text: 'Before you go, will you come back tomorrow?',
        stage: 'question',
      },
    };
  }
  if (answeringFarewellQuestion) {
    return {
      currentIsGoodbye,
      response: { text: farewellClosing(currentText), stage: 'confirm' },
    };
  }
  return { currentIsGoodbye };
}
