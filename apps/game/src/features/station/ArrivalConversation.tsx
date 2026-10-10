import { useEffect, useRef, useState } from 'react';
import { DialogueMessage } from '../../gameplay/DialogueMessage';
import { MessageComposer } from '../../gameplay/MessageComposer';
import { GameButton } from '../../gameplay/GameButton';
import { npcPortraits, playerPortrait } from '../../gameplay/portraits';
import type { ArrivalSnapshot } from './arrival-controller';
import { useNarration } from '../../speech/use-narration';
import { npcVoice } from '../../speech/npc-voice';

// Minimal typed interaction for T8; ticket/progress/Coach presentation belongs to T9.
export function ArrivalConversation({ state, sound, send, retry }: {
  state: ArrivalSnapshot; sound: boolean; send: (text: string) => Promise<boolean>; retry: () => void;
}) {
  const [text, setText] = useState('');
  const history = useRef<HTMLDivElement>(null);
  const lastNpc = state.conversation?.messages.findLast((message) => message.sender === 'npc');
  const voice = useNarration(lastNpc?.text ?? '', sound && !state.pending, lastNpc?.id ?? '', npcVoice.npc_station_information);
  useEffect(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight; }, [state.conversation?.messages]);
  return <>
    <div ref={history} className="conversation-history" role="log" aria-label="Conversation history" aria-live="polite">
      {state.conversation?.messages.map((message) => <DialogueMessage key={message.id}
        name={message.sender === 'player' ? 'You' : 'Receptionist'} text={message.text}
        player={message.sender === 'player'} portrait={message.sender === 'player' ? playerPortrait : npcPortraits.npc_station_information}
        onReplay={() => voice.listen(message.text)} replayDisabled={!sound || !voice.supported || state.pending} />)}
    </div>
    {state.pending ? <p role="status">Waiting for the station server…</p> : null}
    {state.error ? <p role="alert" className="error">{state.error}</p> : null}
    {voice.error ? <p role="status" className="hint">{voice.error}</p> : null}
    {!state.conversation && !state.pending ? <GameButton label="Retry conversation" onClick={retry} /> : null}
    <MessageComposer text={text} onChange={setText} onSend={() => { void send(text).then((sent) => { if (sent) setText(''); }); }}
      pending={state.pending || !state.conversation} voiceSupported={false} listening={false} onRecord={() => {}} />
  </>;
}
