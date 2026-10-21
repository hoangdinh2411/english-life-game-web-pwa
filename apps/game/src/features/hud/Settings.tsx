import { usePreferences } from './usePreferences';
import { useId, useState } from 'react';

export function Settings({ compact = false }: { compact?: boolean }) {
  const { sound, speechRate, speechPitch, set } = usePreferences();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <section aria-label="Settings" className={compact ? 'flex flex-wrap justify-end gap-2 lg:hidden' : 'flex flex-col gap-2'}>
    {!compact ? <h3 className="font-bold">Settings</h3> : null}
    <button type="button" role="switch" aria-label="Sound" aria-checked={sound}
        onClick={() => set('sound', !sound)}
        className={`min-h-11 rounded-xl border-2 border-[#315749] bg-[#fff8e9] px-3 text-[#263630] ${compact && !expanded ? 'min-w-11 p-1' : 'flex items-center justify-between gap-3'}`}>
        {compact && !expanded ? <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span> : <><span>Sound</span><span className="font-bold">{sound ? 'On' : 'Off'}</span></>}
      </button>
    {(!compact || expanded) ? <div className="grid gap-2">
      <label className="grid gap-1 text-sm" htmlFor={`${id}-speech-rate`}>
        <span>Voice speed: <strong>{speechRate.toFixed(2)}×</strong></span>
        <input id={`${id}-speech-rate`} className="h-11" type="range" min="0.75" max="1.5" step="0.05"
          value={speechRate} onChange={event => set('speechRate', Number(event.currentTarget.value))} />
      </label>
      <label className="grid gap-1 text-sm" htmlFor={`${id}-speech-pitch`}>
        <span>Voice pitch: <strong>{speechPitch.toFixed(2)}×</strong></span>
        <input id={`${id}-speech-pitch`} className="h-11" type="range" min="0.75" max="1.25" step="0.05"
          value={speechPitch} onChange={event => set('speechPitch', Number(event.currentTarget.value))} />
      </label>
    </div> : null}
    {compact ? <button type="button" aria-label="Dialogue settings" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="min-h-11 min-w-11 rounded-xl border-2 border-[#315749] bg-dialogue text-ink"><span aria-hidden="true">⚙</span></button> : null}
  </section>;
}
