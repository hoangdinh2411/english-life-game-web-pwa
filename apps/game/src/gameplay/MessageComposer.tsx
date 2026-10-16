import type { ComposerActionProps, MessageComposerProps } from '../types/ui/gameplay';
import { useEffect, useRef } from 'react';
import { ComposerIcon } from './ComposerIcon';
function ComposerAction({ label, kind, disabled, onClick }: ComposerActionProps) {
  return <button type="button" className={`composer-action grid place-items-center w-11 h-11 shrink-0 border-0 rounded-[12px] bg-transparent [&.primary]:bg-[#315749] [&.primary:disabled]:bg-[#e5e7df] [&.primary:disabled]:opacity-[1] ${kind === 'send' ? "primary" : ""}`} aria-label={label} disabled={disabled} onClick={onClick}>
    <ComposerIcon kind={kind} color={disabled ? '#72786e' : kind === 'send' ? '#fffdf6' : '#315749'} />
  </button>;
}
export function MessageComposer({ text, onChange, onSend, onRecord, voiceSupported, listening, pending }: MessageComposerProps) {
  const input = useRef<HTMLTextAreaElement>(null);
  const refocusAfterSend = useRef(false);
  const send = () => { refocusAfterSend.current = true; onSend(); };
  useEffect(() => {
    if (!pending && !listening && refocusAfterSend.current) {
      refocusAfterSend.current = false;
      input.current?.focus();
    }
  }, [pending, listening]);
  return <div className="message-composer flex items-end gap-1 p-1.5 [border:1px_solid_#aa8b57] rounded-[18px] bg-[#fffdf6] [&:focus-within]:border-[#315749] [&_textarea]:flex-1 [&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:max-h-24 [&_textarea]:min-h-11 [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:text-ink [&_textarea]:text-[16px] [&_textarea]:p-2.5 [&_textarea]:resize-y">
    <textarea ref={input} aria-label="Your English reply" placeholder={listening ? 'Listening…' : 'Your reply…'} value={text} onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
          event.preventDefault(); if (!pending) send();
        }
      }} disabled={pending || listening} maxLength={300} rows={2} />
    <div className="composer-actions flex gap-1">
      {voiceSupported ? <ComposerAction label={listening ? 'Stop recording' : 'Record'} kind={listening ? 'stop' : 'microphone'} disabled={pending} onClick={onRecord} /> : null}
      <ComposerAction label="Send" kind="send" disabled={(!text.trim() && !listening) || pending} onClick={send} />
    </div>
  </div>;
}

