import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DialogueMessage } from '../../gameplay/DialogueMessage';
import { MessageComposer } from '../../gameplay/MessageComposer';
import { GameButton } from '../../gameplay/GameButton';
import { npcPortraits, playerPortrait } from '../../gameplay/portraits';
import type { ConversationSnapshot } from './conversation-controller';
import { useNarration } from '../../speech/use-narration';
import { useSpeech } from '../../speech/use-speech';
import { npcVoice } from '../../speech/npc-voice';

export function SavedConversation({ state, sound, online, send, retry, shopNpc, completed = false, details }: {
  state: ConversationSnapshot; sound: boolean; online: boolean;
  send: (text: string, coach: boolean) => Promise<boolean>; retry: () => void;
  shopNpc?: { name: string; portrait: string; portraitPosition: string };
  completed?: boolean; details?: ReactNode;
}) {
  const [text, setText] = useState(state.retryMessage?.text ?? '');
  const [coach, setCoach] = useState(state.retryMessage?.coach ?? false);
  const [finalizing, setFinalizing] = useState(false);
  const sending = useRef(false);
  const history = useRef<HTMLDivElement>(null);
  const speech = useSpeech(setText);
  const blocked = state.pending || finalizing || !online || completed || Boolean(state.conversation?.seller?.closed) || !state.conversation;
  const lastNpc = state.conversation?.messages.findLast((message) => message.sender === 'npc');
  const voice = useNarration(lastNpc?.text ?? '', sound && !state.pending && !speech.listening, lastNpc?.id ?? '', npcVoice[state.conversation?.npcId ?? 'npc_station_information']);
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
    <div ref={history} className="conversation-history h-[min(220px,_28dvh)] min-h-16 overflow-auto pr-1 [@media(max-height:480px)]:h-[120px]" role="log" aria-label="Conversation history" aria-live="polite">
      {state.conversation?.messages.map((message) => <DialogueMessage key={message.id}
        name={message.sender === 'player' ? 'You' : shopNpc?.name ?? 'Receptionist'} text={message.text}
        player={message.sender === 'player'} portrait={message.sender === 'player' ? playerPortrait : shopNpc?.portrait ?? npcPortraits.npc_station_information}
        portraitPosition={message.sender === 'npc' ? shopNpc?.portraitPosition : undefined}
        onReplay={() => voice.listen(message.text)} replayDisabled={!sound || !voice.supported || state.pending || speech.listening} />)}
    </div>
    {details}
    {!online ? <p role="alert" className="error text-[#a43f34] text-[15px] leading-[1.4]">You’re offline. Reconnect to send replies or use your ticket. Your draft stays here; nothing is queued.</p> : null}
    {state.pending ? <p role="status">Waiting for the station server…</p> : null}
    {state.error ? <p role="alert" className="error text-[#a43f34] text-[15px] leading-[1.4]">{state.error}</p> : null}
    {state.retryMessage && !state.pending ? <GameButton label="Retry previous reply" disabled={!online} onClick={() => void submit(true)} /> : null}
    {!state.conversation && !state.pending ? <GameButton label="Retry conversation" disabled={!online} onClick={retry} /> : null}
    <button type="button" className="game-button min-h-11 [padding:10px_16px] border-0 rounded-[12px] bg-[#315749] text-[#fff8e7] text-[15px] font-bold  coach-toggle [align-self:flex-start]" aria-pressed={coach} disabled={state.pending || Boolean(state.retryMessage)} onClick={() => setCoach(!coach)}>{coach ? 'Coach on' : 'Coach off'}</button>
    {coach ? state.correction ? <aside className="coach-feedback flex flex-col [gap:5px] p-2.5 rounded-[12px] bg-[#e5eddf] [overflow-wrap:anywhere]" aria-label="Coach feedback"><strong>A natural way to say it</strong><p>{state.correction.improved}</p><p className="hint text-muted text-[13px] leading-[1.4]">{state.correction.reason}</p></aside> : <p className="hint text-muted text-[13px] leading-[1.4]">Coach can offer a gentle correction after your next reply. It never blocks your progress.</p> : null}
    <MessageComposer text={text} onChange={setText} onSend={() => void submit()}
      pending={blocked} voiceSupported={speech.supported} listening={speech.listening} onRecord={() => { if (speech.listening) void speech.finish(); else { voice.stop(); speech.start(); } }} />
    {speech.supported ? <p className="hint text-muted text-[13px] leading-[1.4]">{speech.listening ? 'Recording… Stop to review, or Send to finish.' : 'Voice may use an online speech service. Review before sending.'}</p> : null}
    {speech.interim ? <p role="status">{speech.interim}</p> : null}
    {speech.error ? <p role="alert" className="error text-[#a43f34] text-[15px] leading-[1.4]">{speech.error}</p> : null}
    {voice.error ? <p role="status" className="hint text-muted text-[13px] leading-[1.4]">{voice.error}</p> : null}
  </>;
}
