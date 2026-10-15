import type { ConversationPanelProps } from '../types/ui/gameplay';
import { useEffect, useRef, useState } from 'react';
import { formatPlayerMessage } from '@life-abroad/shared';
import { useSpeech } from '../speech/use-speech';
import { STATION_NPCS } from './station-navigation';
import { DialogueFrame } from './DialogueFrame';
import { GameButton } from './GameButton';
import { DialogueMessage } from './DialogueMessage';
import { npcPortraits, playerPortrait } from './portraits';
import { useStationConversation } from './use-station-conversation';
import { thinkingSpeaker } from './conversation-history';
import { useNarration } from '../speech/use-narration';
import { npcVoice } from '../speech/npc-voice';
import { MessageComposer } from './MessageComposer';
import { usePreferences } from '../features/hud/usePreferences';
import { shouldUseTypingFallback, useNpcMessageReveal } from '../features/dialogue/use-npc-message-reveal';
export default function ConversationPanel({ npcId, playerName, sound, onClose, onDirections }: ConversationPanelProps) {
  const history = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [coach, setCoach] = useState(false);
  const { coach: coachEnabled } = usePreferences();
  const [mobileFeedback, setMobileFeedback] = useState(true);
  useEffect(() => { setMobileFeedback(true); }, [coachEnabled]);
  const [finalizing, setFinalizing] = useState(false);
  const sending = useRef(false);
  const conversation = useStationConversation(npcId);
  useEffect(() => {
    if (npcId === 'npc_station_information' && conversation.exchange.directions) onDirections?.(true);
  }, [npcId, conversation.exchange.directions, onDirections]);
  useEffect(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight; }, [conversation.messages, conversation.pending]);
  const speech = useSpeech(setText);
  const voice = useNarration(conversation.exchange.text, sound && !speech.listening && !conversation.pending, conversation.messages.at(-1)?.id ?? 0, npcVoice[npcId]);
  const latestMessage = conversation.messages.at(-1);
  const reveal = useNpcMessageReveal(latestMessage ? { id: latestMessage.id, text: latestMessage.text, npc: latestMessage.speaker === 'npc' } : null,
    voice.playback, shouldUseTypingFallback(sound, voice.ready, voice.error));
  const npcName = STATION_NPCS.find((npc) => npc.id === npcId)?.name ?? 'Receptionist';
  const thinking = thinkingSpeaker(speech.listening, conversation.pending);
  const send = async () => {
    if (sending.current || conversation.pending) return;
    sending.current = true;
    try {
      let reply: string | null = text;
      if (speech.listening) { setFinalizing(true); reply = await speech.finish(); }
      if (reply !== null && conversation.send(reply)) { setText(''); setCoach(false); }
    } finally { sending.current = false; setFinalizing(false); }
  };
  return <DialogueFrame soundControl>
    <div className="dialogue-header flex items-center justify-between gap-2 [&_h2]:min-w-0 [&_h2]:[overflow-wrap:anywhere] [&_button]:shrink-0"><h2>{npcName}</h2><GameButton label="Close" onClick={() => { speech.stop(); voice.stop(); onClose(); }} /></div>
    <div ref={history} className="conversation-history h-[min(220px,_28dvh)] min-h-16 overflow-auto pr-1 [@media(max-height:480px)]:h-[120px]" role="log" aria-label="Conversation history" aria-live="polite">
      {conversation.messages.map((message) => {
        const displayText = message.speaker === 'player' ? formatPlayerMessage(message.text) : message.text;
        return <DialogueMessage key={message.id} name={message.speaker === 'player' ? playerName : npcName} portrait={message.speaker === 'player' ? playerPortrait : npcPortraits[npcId]}
          text={reveal?.messageId === message.id ? reveal.visibleText : displayText} fullText={displayText}
          revealing={reveal?.messageId === message.id && reveal.revealing}
          player={message.speaker === 'player'} onReplay={() => voice.listen(displayText)} replayDisabled={!sound || !voice.supported || speech.listening || conversation.pending} />;
      })}
      {thinking ? <DialogueMessage name={thinking === 'player' ? playerName : npcName} portrait={thinking === 'player' ? playerPortrait : npcPortraits[npcId]} player={thinking === 'player'} thinking text="Thinking…" /> : null}
      {speech.interim ? <p>{speech.interim}</p> : null}
    </div>
    <p className="dialogue-hint text-[#52644f] text-[14px] leading-[1.4]">{conversation.exchange.hint}</p>
    <MessageComposer text={text} onChange={setText} onSend={() => void send()} voiceSupported={speech.supported} listening={speech.listening} pending={conversation.pending || finalizing} onRecord={() => { if (speech.listening) void speech.finish(); else { voice.stop(); speech.start(); } }} />
    {speech.supported ? <p className="hint text-muted text-[13px] leading-[1.4]">{finalizing ? 'Finishing recording…' : speech.listening ? 'Recording… Tap Send to finish, or Stop to review.' : 'Voice may use an online speech service. Review before sending.'}</p> : null}
    {speech.error ? <p role="alert" className="error text-[#a43f34] text-[15px] leading-[1.4]">{speech.error}</p> : null}
    {voice.error ? <p role="status" className="hint text-muted text-[13px] leading-[1.4]">{voice.error}</p> : null}
    <div className="hidden lg:contents">{conversation.exchange.correction ? <GameButton label={coach ? 'Hide Coach' : 'Coach'} onClick={() => setCoach(!coach)} /> : null}
    {coach && conversation.exchange.correction ? <p>{conversation.exchange.correction.improved} {conversation.exchange.correction.reason}</p> : null}</div>
    {coachEnabled ? <div className="lg:hidden"><GameButton label="Coach" onClick={() => setMobileFeedback(!mobileFeedback)} />{conversation.exchange.correction && mobileFeedback ? <aside aria-label="Coach feedback">{conversation.exchange.correction.improved} {conversation.exchange.correction.reason}</aside> : null}</div> : null}
  </DialogueFrame>;
}
