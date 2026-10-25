import type { ConversationPanelProps } from '../types/ui/gameplay';
import { useEffect, useRef, useState } from 'react';
import { formatPlayerMessage } from '@life-abroad/shared';
import { useSpeech } from '../speech/use-speech';
import { STATION_NPCS } from './station-navigation';
import { DialogueFrame } from './DialogueFrame';
import { GameButton } from './GameButton';
import { DialogueMessage } from './DialogueMessage';
import { npcPortraits, playerPortraitPresentation } from './portraits';
import { useStationConversation } from './use-station-conversation';
import { thinkingSpeaker } from './conversation-history';
import { useNarration } from '../speech/use-narration';
import { npcVoice } from '../speech/npc-voice';
import { MessageComposer } from './MessageComposer';
import { shouldUseTypingFallback, useNpcMessageReveal } from '../features/dialogue/use-npc-message-reveal';
import { stationNpc } from '../features/station/station-roster';
export default function ConversationPanel({ gender, npcId, playerName, sound, onClose, onDirections }: ConversationPanelProps) {
  const history = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [dismissEndPrompt, setDismissEndPrompt] = useState(false);
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
  const narrationPending = Boolean(sound && voice.ready && !voice.error && latestMessage?.speaker === 'npc' &&
    (voice.playback.revision !== latestMessage.id || voice.playback.progress < 1));
  const npcName = STATION_NPCS.find((npc) => npc.id === npcId)?.name ?? 'Receptionist';
  const npcDefinition = stationNpc(npcId);
  const thinking = thinkingSpeaker(speech.listening, conversation.pending);
  const playerPortrait = playerPortraitPresentation(gender);
  const send = async () => {
    if (sending.current || conversation.pending) return;
    sending.current = true;
    try {
      let reply: string | null = text;
      if (speech.listening) { setFinalizing(true); reply = await speech.finish(); }
      if (reply !== null && conversation.send(reply)) {
        setText(''); setDismissEndPrompt(false);
      }
    } finally { sending.current = false; setFinalizing(false); }
  };
  const showEndPrompt = conversation.farewellStage === 'confirm' && latestMessage?.speaker === 'npc'
    && !conversation.pending && !reveal?.revealing && !voice.speaking && !narrationPending && !dismissEndPrompt;
  if (showEndPrompt) return <DialogueFrame>
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="End the conversation">
      <span>End the conversation?</span><GameButton label="Yes" onClick={onClose} />
      <GameButton label="No" onClick={() => setDismissEndPrompt(true)} />
    </div>
  </DialogueFrame>;
  return <DialogueFrame soundControl>
    <div className="dialogue-header"><h2>{npcName}</h2></div>
    <div ref={history} className="conversation-history h-[min(220px,_28dvh)] min-h-16 max-h-[min(220px,_28dvh)] flex-1 overflow-y-auto overscroll-contain pr-1 [@media(max-height:480px)]:h-[120px] [@media(max-height:480px)]:max-h-[120px]" role="log" aria-label="Conversation history" aria-live="polite">
      {conversation.messages.map((message) => {
        const displayText = message.speaker === 'player' ? formatPlayerMessage(message.text) : message.text;
        return <DialogueMessage key={message.id} name={message.speaker === 'player' ? playerName : npcName} portrait={message.speaker === 'player' ? playerPortrait.portrait : npcPortraits[npcId]}
          portraitPosition={message.speaker === 'player' ? playerPortrait.portraitPosition : npcDefinition.portraitPosition}
          portraitGrid={message.speaker === 'player' ? playerPortrait.portraitGrid : npcDefinition.portraitGrid}
          text={reveal?.messageId === message.id ? reveal.visibleText : displayText} fullText={displayText}
          revealing={reveal?.messageId === message.id && reveal.revealing}
          player={message.speaker === 'player'} onReplay={() => voice.listen(displayText)} replayVisible={sound && voice.supported} replayDisabled={!sound || !voice.supported || speech.listening || conversation.pending} />;
      })}
      {thinking ? <DialogueMessage name={thinking === 'player' ? playerName : npcName} portrait={thinking === 'player' ? playerPortrait.portrait : npcPortraits[npcId]}
        portraitPosition={thinking === 'player' ? playerPortrait.portraitPosition : npcDefinition.portraitPosition}
        portraitGrid={thinking === 'player' ? playerPortrait.portraitGrid : npcDefinition.portraitGrid}
        player={thinking === 'player'} thinking text="Thinking…" replayVisible={false} /> : null}
      {speech.interim ? <p>{speech.interim}</p> : null}
    </div>
    <p className="dialogue-hint text-[var(--color-hint)] text-[14px] leading-[1.4]">{conversation.exchange.hint}</p>
    <MessageComposer text={text} onChange={setText} onSend={() => void send()} voiceSupported={speech.supported} listening={speech.listening} pending={conversation.pending || finalizing} onRecord={() => { if (speech.listening) void speech.finish(); else { voice.stop(); speech.start(); } }} onCancelRecording={() => { speech.stop(); setText(''); }} />
    {finalizing || speech.listening ? <p className="hint text-muted text-[13px] leading-[1.4]">{finalizing ? 'Finishing recording…' : 'Recording… Tap Send to finish, or Stop to review.'}</p> : null}
    {speech.error ? <p role="alert" className="error text-[var(--color-danger)] text-[15px] leading-[1.4]">{speech.error}</p> : null}
    {voice.error ? <p role="status" className="hint text-muted text-[13px] leading-[1.4]">{voice.error}</p> : null}
  </DialogueFrame>;
}
