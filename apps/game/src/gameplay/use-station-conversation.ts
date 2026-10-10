import type { ConversationMessage } from '../types/gameplay/dialogue';
import { useEffect, useRef, useState } from 'react';
import { stationGreeting, stationReply, type StationSpeaker } from '@life-abroad/shared';
import { appendMessage } from './conversation-history';
import { notifyAiFallback } from './ai-fallback';
export function useStationConversation(npcId: StationSpeaker) {
  const [exchange, setExchange] = useState(() => stationGreeting(npcId));
  const [messages, setMessages] = useState<ConversationMessage[]>(() => appendMessage([], 'npc', stationGreeting(npcId).text));
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const send = (input: string) => {
    const text = input.trim();
    if (!text || timer.current) return false;
    setMessages((history) => appendMessage(history, 'player', text));
    setPending(true);
    // A short presentation delay gives the scripted reply its own speaking turn.
    timer.current = setTimeout(() => {
      const next = stationReply(npcId, exchange.step, text, exchange.followUp);
      if (next.aiFallback) notifyAiFallback({ npcId, step: exchange.step });
      setExchange(next); setMessages((history) => appendMessage(history, 'npc', next.text));
      timer.current = null; setPending(false);
    }, 500);
    return true;
  };
  return { exchange, messages, pending, send };
}
