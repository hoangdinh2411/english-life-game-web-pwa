import type { DialogueMessageProps } from '../types/ui/gameplay';
export function DialogueMessage({ name, portrait, portraitPosition, text, fullText, revealing = false, player = false, thinking = false, onReplay, replayDisabled = false }: DialogueMessageProps) {
  return <div className={`dialogue-message flex items-start gap-2.5 [padding:6px_0] [&.player]:flex-row-reverse [&_img]:shrink-0 [&_img]:rounded-[12px] [&_img]:bg-[#e5d8ba] ${player ? "player [&_.message-bubble]:bg-[#e5eddf]" : ""}`}>
    {portraitPosition ? <span role="img" aria-label={`${name} avatar`} className="w-12 h-12 shrink-0 rounded-xl bg-[#e5d8ba]" style={{ backgroundImage: `url(${portrait})`, backgroundSize: '300% 200%', backgroundPosition: portraitPosition }} /> : <img alt={`${name} avatar`} src={portrait} width="48" height="48" />}
    <div className="message-bubble min-w-0 flex-1 bg-[#f0e6d1] rounded-[12px] p-2.5 [&_strong]:text-[#42634f] [&_strong]:text-[13px] [&_p]:mt-1 [&_p]:text-[16px] [&_p]:leading-[1.45] [&_p]:whitespace-pre-wrap [&_p]:[overflow-wrap:anywhere]"><strong>{name}</strong>
      <p>{thinking ? <span role="status">Thinking…</span> : revealing ? <><span className="sr-only">{fullText}</span><span aria-hidden="true">{text}<span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-current align-[-0.12em]" /></span></> : text}</p>
      {!thinking && onReplay ? <button type="button" className="replay-button w-11 min-h-11 border-0 rounded-[10px] bg-[#d6dfcd] mt-1" aria-label={`Replay message from ${name}`} disabled={replayDisabled} onClick={onReplay}>🔊</button> : null}
    </div>
  </div>;
}
