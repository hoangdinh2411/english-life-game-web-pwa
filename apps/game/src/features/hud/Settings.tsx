import { usePreferences } from './usePreferences';
import { useState } from 'react';

export function Settings({ compact = false }: { compact?: boolean }) {
  const { sound, coach, set } = usePreferences();
  const [expanded, setExpanded] = useState(false);
  return <section aria-label="Settings" className={compact ? 'flex flex-wrap justify-end gap-2 lg:hidden' : 'flex flex-col gap-2'}>
    {!compact ? <h3 className="font-bold">Settings</h3> : null}
    {(['sound', 'coach'] as const).filter(setting => !compact || expanded || setting === 'sound').map(setting => {
      const enabled = setting === 'sound' ? sound : coach;
      const name = setting === 'sound' ? 'Sound' : 'Coach';
      return <button key={setting} type="button" role="switch" aria-label={name} aria-checked={enabled}
        onClick={() => set(setting, !enabled)}
        className={`min-h-11 rounded-xl border-2 border-[#315749] bg-[#fff8e9] px-3 text-[#263630] ${compact && !expanded ? 'min-w-11 p-1' : 'flex items-center justify-between gap-3'}`}>
        {compact && !expanded ? <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span> : <><span>{name}</span><span className="font-bold">{enabled ? 'On' : 'Off'}</span></>}
      </button>;
    })}
    {compact ? <button type="button" aria-label="Dialogue settings" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="min-h-11 min-w-11 rounded-xl border-2 border-[#315749] bg-dialogue text-ink"><span aria-hidden="true">⚙</span></button> : null}
  </section>;
}
