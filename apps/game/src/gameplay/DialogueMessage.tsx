import type { DialogueMessageProps } from "../types/ui/gameplay";
export function DialogueMessage({
  name,
  portrait,
  portraitPosition,
  portraitGrid,
  text,
  fullText,
  revealing = false,
  player = false,
  thinking = false,
  onReplay,
  replayVisible,
  replayDisabled = false,
}: DialogueMessageProps) {
  const hasReplaySlot =
    !player && (onReplay !== undefined || replayVisible !== undefined);
  const showReplay =
    hasReplaySlot && !thinking && replayVisible !== false && onReplay;

  return (
    <div
      className={`dialogue-message flex items-start gap-2.5 [padding:6px_0] [&.player]:flex-row-reverse [&_img]:shrink-0 [&_img]:rounded-[12px] [&_img]:bg-[#e5d8ba] ${player ? "player [&_.message-bubble]:bg-[#e5eddf]" : ""}`}
    >
      {portraitPosition ? (
        <span
          role="img"
          aria-label={`${name} avatar`}
          className="w-12 h-12 shrink-0 rounded-xl bg-[#e5d8ba]"
          style={{
            backgroundImage: `url(${portrait})`,
            backgroundSize: `${portraitGrid?.columns ?? 3}00% ${portraitGrid?.rows ?? 2}00%`,
            backgroundPosition: portraitPosition,
          }}
        />
      ) : (
        <img
          alt={`${name} avatar`}
          src={portrait}
          width="48"
          height="48"
        />
      )}
      <div className="message-bubble min-w-0 flex-1 bg-[#f0e6d1] rounded-md p-2.5 [&_strong]:text-[#42634f] [&_strong]:text-[13px] [&_p]:mt-1 [&_p]:text-[16px] [&_p]:leading-[1.45] [&_p]:whitespace-pre-wrap [&_p]:[overflow-wrap:anywhere]">
        <strong>{name}</strong>
        <p className="flex items-center gap-1">
          {thinking ? (
            <span role="status">Thinking…</span>
          ) : revealing ? (
            <>
              <span className="sr-only">{fullText}</span>
              <span aria-hidden="true">
                {text}
                <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-current align-[-0.12em]" />
              </span>
            </>
          ) : (
            text
          )}
          {showReplay ? (
            <button
              type="button"
              className="speaker-control-slot grid size-11 shrink-0 place-items-center rounded-md border-0 bg-transparent text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315749]"
              aria-label={`Replay message from ${name}`}
              disabled={replayDisabled}
              onClick={onReplay}
            >
              🔊
            </button>
          ) : hasReplaySlot ? (
            <span
              aria-hidden="true"
              className="speaker-control-slot invisible grid size-11 shrink-0 place-items-center text-sm"
            >
              🔊
            </span>
          ) : null}
        </p>
        {revealing && !player ? (
          <span aria-hidden="true" className="mt-1 block text-[11px] italic leading-none text-[#6b756b]">
            Typing…
          </span>
        ) : null}
      </div>
    </div>
  );
}
