import type { ConversationMessage } from '../types/gameplay/dialogue';
import { useEffect, useRef, useState } from 'react';
import { detectIntent, farewellClosing, isDirectQuestion, stationGreeting, stationReply, type StationSpeaker, type StationExchange } from '@life-abroad/shared';
import { appendMessage } from './conversation-history';
import { notifyAiFallback } from './ai-fallback';
export function useStationConversation(npcId: StationSpeaker) {
  const [exchange, setExchange] = useState(() => stationGreeting(npcId));
  const [messages, setMessages] = useState<ConversationMessage[]>(() => appendMessage([], 'npc', stationGreeting(npcId).text));
  const [pending, setPending] = useState(false);
  const [farewellStage, setFarewellStage] = useState<'question' | 'confirm' | undefined>();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const send = (input: string) => {
    const text = input.trim();
    if (!text || timer.current) return false;
    const priorGoodbyes = messages.filter(message => message.speaker === 'player' && detectIntent(message.text)?.id === 'goodbye').length;
    const currentIsGoodbye = detectIntent(text)?.id === 'goodbye';
    const lastGoodbyeIndex = messages.findLastIndex(message => message.speaker === 'player' && detectIntent(message.text)?.id === 'goodbye');
    const lastNpcIndex = messages.findLastIndex(message => message.speaker === 'npc');
    const lastNpcMessage = messages[lastNpcIndex];
    const answeringFarewellQuestion = priorGoodbyes > 0 && lastNpcIndex > lastGoodbyeIndex
      && lastNpcMessage?.speaker === 'npc' && isDirectQuestion(lastNpcMessage.text);
    setMessages((history) => appendMessage(history, 'player', text));
    setPending(true);
    // A short presentation delay gives the scripted reply its own speaking turn.
    timer.current = setTimeout(() => {
      let next: StationExchange = stationReply(npcId, exchange.step, text, exchange.followUp);
      if (currentIsGoodbye && priorGoodbyes === 0) {
        next = { ...next, text: 'Before you go, will you come back tomorrow?' };
        setFarewellStage('question');
      } else if (answeringFarewellQuestion) {
        next = { ...next, text: farewellClosing(text) };
        setFarewellStage('confirm');
      } else {
        setFarewellStage(undefined);
      }
      if (next.aiFallback) notifyAiFallback({ npcId, step: exchange.step });
      setExchange(next); setMessages((history) => appendMessage(history, 'npc', next.text));
      timer.current = null; setPending(false);
    }, 500);
    return true;
  };
  return { exchange, messages, pending, farewellStage, send };
}
