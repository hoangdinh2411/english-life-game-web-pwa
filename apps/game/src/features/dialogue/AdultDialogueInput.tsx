import { useEffect, useRef, useState } from "react";
import { ComposerIcon } from "../../gameplay/ComposerIcon";
import { UI_COLORS } from "../../styles/colors";

export interface AdultDialogueInputProps {
  text: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onRecord: () => void;
  onCancelRecording: () => void;
  listening: boolean;
  pending: boolean;
  voiceSupported: boolean;
  hintFrames?: string[];
  defaultHintOpen?: boolean;
}

const DEFAULT_HINT_FRAMES = [
  "I would like to…",
  "Could you please tell me…",
  "How much does it cost?",
  "Thank you so much!",
];

export function AdultDialogueInput({
  text,
  onChangeText,
  onSend,
  onRecord,
  onCancelRecording,
  listening,
  pending,
  voiceSupported,
  hintFrames = DEFAULT_HINT_FRAMES,
  defaultHintOpen = false,
}: AdultDialogueInputProps) {
  const [hintOpen, setHintOpen] = useState(defaultHintOpen);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!pending && !listening) {
      inputRef.current?.focus();
    }
  }, [pending, listening]);

  const handleSelectHint = (frame: string) => {
    onChangeText(frame);
    setHintOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="adult-dialogue-input flex flex-col gap-1.5">
      {/* Contextual Hint Drawer */}
      {hintOpen ? (
        <div
          role="region"
          aria-label="Sentence starters"
          className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--color-gold-border)] bg-[var(--color-dialogue)] p-2 shadow-sm animate-in fade-in"
        >
          <span className="text-xs font-bold text-[var(--color-green-strong)]">Sentence starters:</span>
          {hintFrames.map((frame, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectHint(frame)}
              className="rounded-lg border border-[var(--color-border)] bg-card px-2 py-1 text-xs text-ink hover:bg-[var(--color-success-surface)] transition-colors"
            >
              {frame}
            </button>
          ))}
        </div>
      ) : null}

      {/* Modern Chat-style Bottom Bar */}
      <div className="flex items-end gap-1 rounded-2xl border border-[var(--color-gold-border)] bg-[var(--color-cream-text-pure)] p-1.5 shadow-sm">
        {/* Hint Bulb Button */}
        <button
          type="button"
          onClick={() => setHintOpen(prev => !prev)}
          className={`grid size-10 shrink-0 place-items-center rounded-xl border transition-colors ${
            hintOpen
              ? "border-[var(--color-gold-border)] bg-[var(--color-gold)] text-ink"
              : "border-transparent text-muted hover:text-ink hover:bg-[var(--color-paper)]"
          }`}
          aria-label={hintOpen ? "Close hint starters" : "Open hint starters"}
          aria-expanded={hintOpen}
        >
          <span className="text-base" aria-hidden="true">💡</span>
        </button>

        {/* Text Area */}
        {listening ? (
          <div
            role="status"
            aria-label="Listening…"
            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-[var(--color-success-surface-alt)] px-3 text-[var(--color-green-strong)] text-sm font-semibold"
          >
            <span>Listening… speak clearly</span>
            <button
              type="button"
              onClick={onCancelRecording}
              className="ml-auto text-xs text-[var(--color-danger)] underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <textarea
            ref={inputRef}
            aria-label="Your English reply"
            placeholder="Type your message…"
            value={text}
            onChange={e => onChangeText(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (!pending && text.trim()) onSend();
              }
            }}
            disabled={pending}
            maxLength={300}
            rows={1}
            className="flex-1 min-w-0 max-h-24 min-h-10 border-0 bg-transparent text-ink text-[15px] px-2 py-2 resize-y focus:outline-none"
          />
        )}

        {/* Mic & Send Buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {voiceSupported ? (
            <button
              type="button"
              aria-label={listening ? "Stop recording" : "Record voice"}
              onClick={onRecord}
              disabled={pending}
              className={`grid size-10 place-items-center rounded-xl border border-transparent transition-colors ${
                listening
                  ? "bg-[var(--color-danger)] text-white animate-pulse"
                  : "text-muted hover:text-ink hover:bg-[var(--color-paper)]"
              }`}
            >
              <ComposerIcon kind={listening ? "stop" : "microphone"} color={listening ? UI_COLORS.creamTextPure : UI_COLORS.greenStrong} />
            </button>
          ) : null}

          <button
            type="button"
            aria-label="Send"
            disabled={!text.trim() || pending}
            onClick={onSend}
            className="grid size-10 place-items-center rounded-xl border-0 bg-[var(--color-green-strong)] text-white shadow-xs disabled:bg-[var(--color-disabled-surface)] disabled:text-muted hover:opacity-90 transition-opacity"
          >
            <ComposerIcon kind="send" color={text.trim() && !pending ? UI_COLORS.creamTextPure : UI_COLORS.iconMuted} />
          </button>
        </div>
      </div>
    </div>
  );
}
