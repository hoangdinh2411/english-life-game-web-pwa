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
      className={`dialogue-message flex flex-col gap-1 [padding:6px_0] [&_img]:shrink-0 [&_img]:rounded-[12px] [&_img]:bg-[var(--color-portrait-placeholder)] ${player ? "player items-end [&_.message-bubble]:bg-[var(--color-success-surface-alt)]" : "items-start"}`}
    >
      <div className={`dialogue-message-row flex flex-1 gap-2 ${player ? "flex-row-reverse" : ""}`}>
        {portraitPosition ? (
          <span
            role="img"
            aria-label={`${name} avatar`}
            className="w-12 h-12 shrink-0 rounded-xl bg-[var(--color-portrait-placeholder)]"
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
        <div className="message-bubble min-w-0  flex-1 bg-[var(--color-cream-muted)] rounded-md p-2 [&_strong]:text-[var(--color-message-strong)] [&_strong]:text-[13px] [&_p]:mt-1 [&_p]:text-[16px] [&_p]:leading-[1.45] [&_p]:whitespace-pre-wrap [&_p]:[overflow-wrap:anywhere]">
          <strong>{name}</strong>
          <p className="flex items-center gap-1">
            {thinking ? (
              <span role="status">Thinking…</span>
            ) : revealing ? (
              <span className="grid min-w-0 flex-1">
                <span className="sr-only">{fullText}</span>
                <span
                  aria-hidden="true"
                  className="reveal-layout-reserve invisible col-start-1 row-start-1"
                >
                  {fullText}
                </span>
                <span
                  aria-hidden="true"
                  className="col-start-1 row-start-1"
                >
                  {text}
                </span>
              </span>
            ) : (
              text
            )}
            {showReplay ? (
              <button
                type="button"
                className="speaker-control-slot grid size-11 shrink-0 place-items-center rounded-md border-0 bg-transparent text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-green-strong)]"
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
        </div>
      </div>
      {revealing && !player ? (
        <span
          aria-hidden="true"
          className="ml-14 block text-[11px] italic leading-none text-[var(--color-speaker-muted)]"
        >
          Typing…
        </span>
      ) : null}
    </div>
  );
}
