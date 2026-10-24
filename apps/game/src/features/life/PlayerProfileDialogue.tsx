import { EnergyDisplay } from './EnergyDisplay';
import type { LifeControls } from './useLife';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { GameButton } from '../../gameplay/GameButton';
import { PlayerPortrait } from '../appearance/PlayerPortrait';
import type { PlayerGender } from '@life-abroad/shared';

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-[10px] bg-[#f0e6d1] [border:1px_solid_#8b806c] p-2.5">
    <dt className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#52644f]">{label}</dt>
    <dd className="mt-0.5 min-w-0 [overflow-wrap:anywhere] text-[16px] font-bold leading-tight text-[#263630]">{value}</dd>
  </div>;
}

export function PlayerProfileDialogue({
  gender,
  playerName,
  cityName,
  xp,
  coins,
  life,
  online,
  practice,
  onClose,
}: {
  gender?: PlayerGender | undefined;
  playerName: string;
  cityName: string;
  xp: number;
  coins: number;
  life?: LifeControls;
  online: boolean;
  practice: boolean;
  onClose: () => void;
}) {
  const state = life?.state;
  const energyDisabled = !online || Boolean(life?.pending || life?.retry || !state);

  return <DialogueFrame ariaLabel="Your character">
    <div className="flex items-center justify-between gap-2 [@media(max-width:699px)]:items-start">
      <h2 className="text-[18px] font-extrabold">Your character</h2>
      <GameButton label="Close" ariaLabel="Close profile" onClick={onClose} />
    </div>
    <div className="flex min-w-0 items-center gap-3 rounded-[14px] bg-[#e5eddf] p-3 [@media(max-width:479px)]:p-2">
      <PlayerPortrait gender={gender} label={`${playerName}'s avatar`} className="size-[68px] rounded-[14px] [border:2px_solid_#8b806c]" />
      <div className="min-w-0">
        <h3 className="[overflow-wrap:anywhere] text-[18px] font-extrabold leading-tight text-[#263630]">{playerName}</h3>
        <p className="mt-1 text-[14px] text-[#52644f]">{cityName}</p>
      </div>
    </div>
    <dl className="grid min-w-0 grid-cols-2 gap-2">
      <Stat label="Experience" value={`${xp} XP`} />
      <Stat label="Wallet" value={`$${state?.coins ?? coins}`} />
      {state ? <Stat label="Energy" value={`${state.energy}%`} /> : life ? <Stat label="Energy" value="Loading" /> : null}
    </dl>
    {state ? <div className="lg:hidden"><h3 className="font-bold">Appearance</h3><p className="text-sm [overflow-wrap:anywhere]">Hair: {state.appearance.hair} · Shirt: {state.appearance.shirt ?? 'default'} · Trousers: {state.appearance.trousers}</p></div> : null}
    {life?.error ? <p role="alert" className="text-[14px] text-[#843514]">{life.error}</p> : null}
    {life?.retry ? <div className="flex flex-col gap-2">
      <p className="text-[13px] text-[#52644f]">The previous action may have saved. Retry to check safely.</p>
      <GameButton label="Retry previous action" disabled={!online || life.pending} onClick={() => void life.act(life.retry!)} />
    </div> : null}
    {state && life ? <EnergyDisplay
      energy={state.energy}
      onSleep={() => void life.act({ path: 'sleep', body: { key: crypto.randomUUID() } })}
      sleepDisabled={energyDisabled}
    /> : null}
    {!online && !practice ? <p className="text-[13px] text-[#52644f]" role="status">Reconnect to save changes.</p> : null}
  </DialogueFrame>;
}
