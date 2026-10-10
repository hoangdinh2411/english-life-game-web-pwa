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
export default function ConversationPanel({ npcId, playerName, sound, onClose, onDirections }: ConversationPanelProps) {
  const history = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [coach, setCoach] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const sending = useRef(false);
  const conversation = useStationConversation(npcId);
  useEffect(() => {
    if (npcId === 'npc_station_information' && conversation.exchange.directions) onDirections?.(true);
  }, [npcId, conversation.exchange.directions, onDirections]);
  useEffect(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight; }, [conversation.messages, conversation.pending]);
  const speech = useSpeech(setText);
  const voice = useNarration(conversation.exchange.text, sound && !speech.listening && !conversation.pending, conversation.messages.at(-1)?.id ?? 0, npcVoice[npcId]);
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
  return <DialogueFrame>
    <div className="dialogue-header"><h2>{npcName}</h2><GameButton label="Close" onClick={() => { speech.stop(); voice.stop(); onClose(); }} /></div>
    <div ref={history} className="conversation-history" role="log" aria-label="Conversation history" aria-live="polite">
      {conversation.messages.map((message) => {
        const displayText = message.speaker === 'player' ? formatPlayerMessage(message.text) : message.text;
        return <DialogueMessage key={message.id} name={message.speaker === 'player' ? playerName : npcName} portrait={message.speaker === 'player' ? playerPortrait : npcPortraits[npcId]} text={displayText} player={message.speaker === 'player'} onReplay={() => voice.listen(displayText)} replayDisabled={!sound || !voice.supported || speech.listening || conversation.pending} />;
      })}
      {thinking ? <DialogueMessage name={thinking === 'player' ? playerName : npcName} portrait={thinking === 'player' ? playerPortrait : npcPortraits[npcId]} player={thinking === 'player'} thinking text="Thinking…" /> : null}
      {speech.interim ? <p>{speech.interim}</p> : null}
    </div>
    <p className="dialogue-hint">{conversation.exchange.hint}</p>
    <MessageComposer text={text} onChange={setText} onSend={() => void send()} voiceSupported={speech.supported} listening={speech.listening} pending={conversation.pending || finalizing} onRecord={() => { if (speech.listening) void speech.finish(); else { voice.stop(); speech.start(); } }} />
    {speech.supported ? <p className="hint">{finalizing ? 'Finishing recording…' : speech.listening ? 'Recording… Tap Send to finish, or Stop to review.' : 'Voice may use an online speech service. Review before sending.'}</p> : null}
    {speech.error ? <p role="alert" className="error">{speech.error}</p> : null}
    {voice.error ? <p role="status" className="hint">{voice.error}</p> : null}
    {conversation.exchange.correction ? <GameButton label={coach ? 'Hide Coach' : 'Coach'} onClick={() => setCoach(!coach)} /> : null}
    {coach && conversation.exchange.correction ? <p>{conversation.exchange.correction.improved} {conversation.exchange.correction.reason}</p> : null}
  </DialogueFrame>;
}
