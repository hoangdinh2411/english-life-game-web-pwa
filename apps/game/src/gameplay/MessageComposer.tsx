import type { ComposerActionProps, MessageComposerProps } from '../types/ui/gameplay';
import { ComposerIcon } from './ComposerIcon';
function ComposerAction({ label, kind, disabled, onClick }: ComposerActionProps) {
  return <button type="button" className={kind === 'send' ? 'composer-action primary' : 'composer-action'} aria-label={label} disabled={disabled} onClick={onClick}>
    <ComposerIcon kind={kind} color={disabled ? '#72786e' : kind === 'send' ? '#fffdf6' : '#315749'} />
  </button>;
}
export function MessageComposer({ text, onChange, onSend, onRecord, voiceSupported, listening, pending }: MessageComposerProps) {
  return <div className="message-composer">
    <textarea aria-label="Your English reply" placeholder={listening ? 'Listening…' : 'Your reply…'} value={text} onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
          event.preventDefault(); if (!pending) onSend();
        }
      }} disabled={pending || listening} maxLength={500} rows={2} />
    <div className="composer-actions">
      {voiceSupported ? <ComposerAction label={listening ? 'Stop recording' : 'Record'} kind={listening ? 'stop' : 'microphone'} disabled={pending} onClick={onRecord} /> : null}
      <ComposerAction label="Send" kind="send" disabled={(!text.trim() && !listening) || pending} onClick={onSend} />
    </div>
  </div>;
}

