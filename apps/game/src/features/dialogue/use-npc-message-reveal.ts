import { useEffect, useRef, useState } from 'react';

export interface RevealMessage {
  id: string | number;
  text: string;
  npc: boolean;
}

export function selectAutomaticReveal(observedId: string | number | null | undefined,
  active: RevealMessage | null, latest: RevealMessage | null): { observedId: string | number | null; active: RevealMessage | null } {
  if (observedId === undefined) return { observedId: latest?.id ?? null, active: null };
  if (!latest || latest.id === observedId) return { observedId, active };
  return { observedId: latest.id, active: latest.npc ? latest : null };
}

export function textAtProgress(text: string, progress: number): string {
  const characters = Array.from(text);
  const clamped = Math.max(0, Math.min(1, progress));
  const count = Math.ceil(characters.length * clamped);
  return characters.slice(0, count).join('');
}

export function shouldUseTypingFallback(sound: boolean, narrationReady: boolean, narrationError: string): boolean {
  return !sound || !narrationReady || narrationError.length > 0;
}

export function shouldAutomaticallyRevealNpcMessage(
  messageId: string | number,
  streamedMessageId: string | number | null | undefined,
): boolean {
  return messageId !== streamedMessageId;
}

export function preserveCompletedReveal(messageId: string | number, progress: number,
  completedMessageId: string | number | null): { progress: number; completedMessageId: string | number | null } {
  if (completedMessageId === messageId) return { progress: 1, completedMessageId };
  return progress >= 1
    ? { progress: 1, completedMessageId: messageId }
    : { progress, completedMessageId };
}

function reducedMotionPreferred(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export function useNpcMessageReveal(latest: RevealMessage | null,
  playback: { revision: string | number | null; progress: number }, fallback: boolean) {
  const initialMessage = useRef<string | number | null | undefined>(undefined);
  const active = useRef<RevealMessage | null>(null);
  const completedMessageId = useRef<string | number | null>(null);
  const [fallbackProgress, setFallbackProgress] = useState<{ messageId: string | number | null; progress: number }>({ messageId: null, progress: 0 });
  const reducedMotion = reducedMotionPreferred();

  const selection = selectAutomaticReveal(initialMessage.current, active.current, latest);
  initialMessage.current = selection.observedId;
  active.current = selection.active;

  useEffect(() => {
    setFallbackProgress({ messageId: active.current?.id ?? null, progress: 0 });
    if (!active.current || !fallback || reducedMotion) return;
    const textLength = Math.max(1, Array.from(active.current.text).length);
    const increment = Math.max(1, Math.ceil(textLength / 120)) / textLength;
    const messageId = active.current.id;
    const timer = window.setInterval(() => setFallbackProgress(value => {
      if (value.messageId !== messageId) return value;
      const next = Math.min(1, value.progress + increment);
      if (next === 1) window.clearInterval(timer);
      return { messageId, progress: next };
    }), 50);
    return () => window.clearInterval(timer);
  }, [latest?.id, fallback, reducedMotion]);

  if (!active.current || active.current.id !== latest?.id) return null;
  const sourceProgress = reducedMotion ? 1 : fallback ? fallbackProgress.messageId === active.current.id ? fallbackProgress.progress : 0
    : playback.revision === active.current.id ? playback.progress : 0;
  const preserved = preserveCompletedReveal(active.current.id, sourceProgress, completedMessageId.current);
  completedMessageId.current = preserved.completedMessageId;
  const progress = preserved.progress;
  return { messageId: active.current.id, visibleText: textAtProgress(active.current.text, progress), revealing: progress < 1 };
}
