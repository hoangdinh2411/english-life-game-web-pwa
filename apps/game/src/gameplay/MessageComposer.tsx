import type { ComposerActionProps, MessageComposerProps } from '../types/ui/gameplay';
import { useEffect, useRef } from 'react';
import { ComposerIcon } from './ComposerIcon';
import { UI_COLORS } from '../styles/colors';
const WAVEFORM_HEIGHTS = [12, 22, 30, 18, 34, 24, 14, 28, 16] as const;
function ComposerAction({ label, kind, disabled, onClick }: ComposerActionProps) {
  return <button type="button" className={`composer-action grid place-items-center w-11 h-11 shrink-0 border-0 rounded-[12px] bg-transparent [&.primary]:bg-[var(--color-green-strong)] [&.primary:disabled]:bg-[var(--color-disabled-surface)] [&.primary:disabled]:opacity-[1] ${kind === 'send' ? "primary" : ""}`} aria-label={label} disabled={disabled} onClick={onClick}>
    <ComposerIcon kind={kind} color={disabled ? UI_COLORS.iconMuted : kind === 'send' ? UI_COLORS.creamTextPure : UI_COLORS.greenStrong} />
  </button>;
}
export function MessageComposer({ text, onChange, onSend, onRecord, onCancelRecording, voiceSupported, listening, pending }: MessageComposerProps) {
  const input = useRef<HTMLTextAreaElement>(null);
  const refocusAfterSend = useRef(false);
  const send = () => { refocusAfterSend.current = true; onSend(); };
  const cancelRecording = () => { refocusAfterSend.current = true; onCancelRecording(); };
  useEffect(() => {
    if (!pending && !listening && refocusAfterSend.current) {
      refocusAfterSend.current = false;
      input.current?.focus();
    }
  }, [pending, listening]);
  return <div className="message-composer flex items-end gap-1 p-1.5 [border:1px_solid_var(--color-gold-border)] rounded-[18px] bg-[var(--color-cream-text-pure)] [&:focus-within]:border-[var(--color-green-strong)] [&_textarea]:flex-1 [&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:max-h-24 [&_textarea]:min-h-11 [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:text-ink [&_textarea]:text-[16px] [&_textarea]:p-2.5 [&_textarea]:resize-y">
    {listening ? <div data-testid="audio-waveform" role="status" aria-label="Listening…" className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-[var(--color-success-surface-alt)] px-2 text-[var(--color-green-strong)]">
      <button type="button" aria-label="Cancel recording and clear transcript" className="grid size-11 shrink-0 place-items-center rounded-lg border-0 bg-transparent text-2xl leading-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-green-strong)]" onClick={cancelRecording}>×</button>
      <span aria-hidden="true" className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden">
        {WAVEFORM_HEIGHTS.map((height, index) => <span key={index} className="w-1 shrink-0 rounded-full bg-[var(--color-green-strong)] [animation:audio-waveform_900ms_ease-in-out_infinite] [@media(prefers-reduced-motion:reduce)]:animate-none" style={{ height, animationDelay: `${index * -90}ms` }} />)}
      </span>
      <span className="sr-only">Listening…</span>
    </div> : <textarea ref={input} aria-label="Your English reply" placeholder="Your reply…" value={text} onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
          event.preventDefault(); if (!pending) send();
        }
      }} disabled={pending} maxLength={300} rows={2} />}
    <div className="composer-actions flex gap-1">
      {voiceSupported ? <ComposerAction label={listening ? 'Stop recording' : 'Record'} kind={listening ? 'stop' : 'microphone'} disabled={pending} onClick={onRecord} /> : null}
      <ComposerAction label="Send" kind="send" disabled={(!text.trim() && !listening) || pending} onClick={send} />
    </div>
  </div>;
}
