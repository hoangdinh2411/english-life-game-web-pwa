import { useId, useState } from 'react';
import type { Preferences } from './preferences';
import type { PreferenceSyncStatus } from './synced-preferences';
import { usePreferences } from './usePreferences';
import { GameIcon } from '../../shared/GameIcon';

type SetPreference = <Setting extends keyof Preferences>(setting: Setting, value: Preferences[Setting]) => void;

interface PreferenceControlsProps extends Preferences {
  compact: boolean;
  practice: boolean;
  status: PreferenceSyncStatus;
  set: SetPreference;
  retry: () => Promise<void>;
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={onChange}
    className="flex min-h-11 items-center justify-between gap-3 rounded-xl border-2 border-green-strong bg-dialogue px-3 text-ink">
    <span>{label}</span><span className="font-bold">{checked ? 'On' : 'Off'}</span>
  </button>;
}

function SyncFeedback({ status, retry }: Pick<PreferenceControlsProps, 'status' | 'retry'>) {
  if (status === 'loading' || status === 'saving') return <p role="status" className="text-sm text-muted">
    {status === 'loading' ? 'Loading account settings…' : 'Saving account settings…'}
  </p>;
  if (status === 'saved') return <p role="status" className="text-sm text-green-strong">Account settings saved.</p>;
  if (status === 'error') return <div role="alert" className="grid gap-2 text-sm text-danger">
    <span>Settings are not synchronized. Your current choices still work on this device.</span>
    <button type="button" onClick={() => void retry()}
      className="min-h-11 rounded-xl border-2 border-border bg-paper px-3 font-bold text-ink">Retry</button>
  </div>;
  return null;
}

export function PreferenceControls({
  sound, speechRate, speechPitch, status, set, retry, compact, practice,
}: PreferenceControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const showDetails = !compact || expanded;
  return <section aria-label="Settings controls" className={compact ? 'flex flex-wrap justify-end gap-2 lg:hidden' : 'grid gap-3'}>
    {compact && !expanded ? <button type="button" role="switch" aria-label="Sound" aria-checked={sound}
      onClick={() => set('sound', !sound)}
      className="min-h-11 min-w-11 rounded-xl border-2 border-green-strong bg-dialogue p-1 text-ink">
      <GameIcon name={sound ? 'sound-on' : 'sound-off'} className="mx-auto size-4" />
    </button> : null}
    {showDetails ? <>
      <div className="grid gap-2">
        <SwitchRow label="Sound" checked={sound} onChange={() => set('sound', !sound)} />
      </div>
      <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
      <label className="grid min-w-0 gap-1 text-sm" htmlFor={`${id}-speech-rate`}>
        <span>Voice speed: <strong>{speechRate.toFixed(2)}×</strong></span>
        <input id={`${id}-speech-rate`} className="h-11 max-w-full" type="range" min="0.75" max="1.5" step="0.05"
          value={speechRate} onChange={event => set('speechRate', Number(event.currentTarget.value))} />
      </label>
      {!compact ? <label className="grid min-w-0 gap-1 text-sm" htmlFor={`${id}-speech-pitch`}>
        <span>Voice pitch: <strong>{speechPitch.toFixed(2)}×</strong></span>
        <input id={`${id}-speech-pitch`} className="h-11 max-w-full" type="range" min="0.75" max="1.25" step="0.05"
          value={speechPitch} onChange={event => set('speechPitch', Number(event.currentTarget.value))} />
      </label> : null}
      </div>
      {!practice && status !== 'local' ? <SyncFeedback status={status} retry={retry} /> : null}
    </> : null}
    {compact ? <button type="button" aria-label="Dialogue settings" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="grid size-8 place-items-center rounded-lg border border-green-strong bg-dialogue text-ink sm:size-9"><GameIcon name="settings" className="size-4" /></button> : null}
  </section>;
}

export function Settings({ compact = false, practice = false }: { compact?: boolean; practice?: boolean }) {
  const preferences = usePreferences();
  return <PreferenceControls {...preferences} compact={compact} practice={practice} />;
}
