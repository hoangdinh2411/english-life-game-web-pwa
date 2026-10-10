import { useEffect, useRef, useState } from 'react';
import { DialogueMessage } from '../../gameplay/DialogueMessage';
import { MessageComposer } from '../../gameplay/MessageComposer';
import { GameButton } from '../../gameplay/GameButton';
import { npcPortraits, playerPortrait } from '../../gameplay/portraits';
import type { ArrivalSnapshot } from './arrival-controller';
import { useNarration } from '../../speech/use-narration';
import { useSpeech } from '../../speech/use-speech';
import { npcVoice } from '../../speech/npc-voice';
import { TicketReceipt } from './ArrivalQuest';
import { arrivalPresentation } from './arrival-presentation';

export function ArrivalConversation({ state, sound, online, send, retry }: {
  state: ArrivalSnapshot; sound: boolean; online: boolean;
  send: (text: string, coach: boolean) => Promise<boolean>; retry: () => void;
}) {
  const [text, setText] = useState(state.retryMessage?.text ?? '');
  const [coach, setCoach] = useState(state.retryMessage?.coach ?? false);
  const [finalizing, setFinalizing] = useState(false);
  const sending = useRef(false);
  const history = useRef<HTMLDivElement>(null);
  const speech = useSpeech(setText);
  const completed = state.arrival?.status === 'done';
  const blocked = state.pending || finalizing || !online || completed || !state.conversation;
  const lastNpc = state.conversation?.messages.findLast((message) => message.sender === 'npc');
  const voice = useNarration(lastNpc?.text ?? '', sound && !state.pending && !speech.listening, lastNpc?.id ?? '', npcVoice.npc_station_information);
  useEffect(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight; }, [state.conversation?.messages]);
  const submit = async (original = false) => {
    if (sending.current || blocked) return;
    sending.current = true;
    try {
      let reply: string | null = original ? state.retryMessage?.text ?? text : text;
      if (speech.listening) { setFinalizing(true); reply = await speech.finish(); }
      const preference = original ? state.retryMessage?.coach ?? coach : coach;
      if (reply !== null && await send(reply, preference)) { setText(''); }
    } finally { sending.current = false; setFinalizing(false); }
  };
  return <>
    <div ref={history} className="conversation-history" role="log" aria-label="Conversation history" aria-live="polite">
      {state.conversation?.messages.map((message) => <DialogueMessage key={message.id}
        name={message.sender === 'player' ? 'You' : 'Receptionist'} text={message.text}
        player={message.sender === 'player'} portrait={message.sender === 'player' ? playerPortrait : npcPortraits.npc_station_information}
        onReplay={() => voice.listen(message.text)} replayDisabled={!sound || !voice.supported || state.pending || speech.listening} />)}
    </div>
    {state.arrival?.ticket.issued ? <TicketReceipt arrival={state.arrival} /> : null}
    {state.arrival ? <p className="dialogue-hint">{arrivalPresentation(state.arrival).next}</p> : null}
    {!online ? <p role="alert" className="error">You’re offline. Reconnect to send replies or use your ticket. Your draft stays here; nothing is queued.</p> : null}
    {state.pending ? <p role="status">Waiting for the station server…</p> : null}
    {state.error ? <p role="alert" className="error">{state.error}</p> : null}
    {state.retryMessage && !state.pending ? <GameButton label="Retry previous reply" disabled={!online} onClick={() => void submit(true)} /> : null}
    {!state.conversation && !state.pending ? <GameButton label="Retry conversation" disabled={!online} onClick={retry} /> : null}
    <button type="button" className="game-button coach-toggle" aria-pressed={coach} disabled={state.pending || Boolean(state.retryMessage)} onClick={() => setCoach(!coach)}>{coach ? 'Coach on' : 'Coach off'}</button>
    {coach ? state.correction ? <aside className="coach-feedback" aria-label="Coach feedback"><strong>A natural way to say it</strong><p>{state.correction.improved}</p><p className="hint">{state.correction.reason}</p></aside> : <p className="hint">Coach can offer a gentle correction after your next reply. It never blocks your progress.</p> : null}
    <MessageComposer text={text} onChange={setText} onSend={() => void submit()}
      pending={blocked} voiceSupported={speech.supported} listening={speech.listening} onRecord={() => { if (speech.listening) void speech.finish(); else { voice.stop(); speech.start(); } }} />
    {speech.supported ? <p className="hint">{speech.listening ? 'Recording… Stop to review, or Send to finish.' : 'Voice may use an online speech service. Review before sending.'}</p> : null}
    {speech.interim ? <p role="status">{speech.interim}</p> : null}
    {speech.error ? <p role="alert" className="error">{speech.error}</p> : null}
    {voice.error ? <p role="status" className="hint">{voice.error}</p> : null}
  </>;
}
