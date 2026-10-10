import type { DialogueMessageProps } from '../types/ui/gameplay';
export function DialogueMessage({ name, portrait, text, player = false, thinking = false, onReplay, replayDisabled = false }: DialogueMessageProps) {
  return <div className={player ? 'dialogue-message player' : 'dialogue-message'}>
    <img alt={`${name} avatar`} src={portrait} width="48" height="48" />
    <div className="message-bubble"><strong>{name}</strong>
      <p>{thinking ? <span role="status">Thinking…</span> : text}</p>
      {!thinking && onReplay ? <button type="button" className="replay-button" aria-label={`Replay message from ${name}`} disabled={replayDisabled} onClick={onReplay}>🔊</button> : null}
    </div>
  </div>;
}
