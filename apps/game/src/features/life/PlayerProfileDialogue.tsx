import { useState } from 'react';
import type { IdCardResponse } from '@life-abroad/shared';
import { EnergyDisplay } from './EnergyDisplay';
import type { LifeControls } from './useLife';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { GameButton } from '../../gameplay/GameButton';
import { PlayerPortrait } from '../appearance/PlayerPortrait';
import type { PlayerGender } from '@life-abroad/shared';
import { GameIcon } from '../../shared/GameIcon';

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg bg-[var(--color-cream-muted)] [border:1px_solid_var(--color-border)] px-2 py-1.5">
    <dt className="truncate text-[10px] font-bold uppercase tracking-[0.03em] text-[var(--color-hint)]">{label}</dt>
    <dd className="mt-0.5 truncate text-[14px] font-bold leading-tight text-[var(--color-ink)]">{value}</dd>
  </div>;
}

function capitalizeWords(value: string): string {
  return value.replace(/\S+/g, word => `${word[0]!.toLocaleUpperCase()}${word.slice(1)}`);
}

function IdCardDetails({ idCard, gender, playerName, onClose }: {
  idCard: IdCardResponse;
  gender?: PlayerGender | undefined;
  playerName: string;
  onClose: () => void;
}) {
  return <div
    className="absolute inset-0 z-10 grid place-items-center bg-transparent p-3"
    role="presentation"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
    onTouchStart={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <section aria-label="ID card information" role="dialog" aria-modal="true" tabIndex={-1}
      className="relative w-[min(520px,calc(100vw_-_32px))] overflow-hidden rounded-[18px] border-[3px] border-[var(--color-gold-border)] bg-[var(--color-cream-text-pure)] shadow-[0_6px_18px_var(--color-shadow)] outline-none [aspect-ratio:1.75]">
      <div className="absolute inset-x-0 top-0 h-[34%] rounded-t-[15px] border-b-[3px] border-[var(--color-gold-border)] bg-[var(--color-success-surface-alt)]" />
      <div className="absolute left-1/2 top-[18%] grid size-[23%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[5px] border-[var(--color-gold-border)] bg-[var(--color-cream-muted)] text-[var(--color-gold-border)] shadow-[0_2px_0_var(--color-shadow)]">
        <GameIcon name="id-card" className="size-[55%]" />
      </div>
      <div className="relative h-full min-w-0 px-[7%] pb-[6%] pt-[35%]">
        {idCard.photoUrl ? (
          <img src={idCard.photoUrl} alt={`${idCard.fullName}'s ID card photo`} className="absolute left-[7%] top-[38%] h-auto w-[28%] aspect-square rounded-[10px] object-cover border-[3px] border-[var(--color-gold-border)]" />
        ) : (
          <PlayerPortrait gender={gender} label={`${playerName}'s avatar`} className="absolute left-[7%] top-[38%] h-auto w-[28%] aspect-square rounded-[10px] border-[3px] border-[var(--color-gold-border)]" />
        )}
        <div className="absolute left-[42%] right-[7%] top-[37%] min-w-0">
          <p className="min-w-0 [overflow-wrap:anywhere] text-[clamp(15px,2.4vw,21px)] font-extrabold leading-tight text-[var(--color-ink)]">{capitalizeWords(idCard.fullName)}</p>
          <dl className="mt-[5%] grid gap-1 text-[clamp(9px,1.35vw,12px)] leading-tight text-[var(--color-ink)]">
            <div className="grid min-w-0 grid-cols-[clamp(52px,22%,76px)_minmax(0,1fr)] items-baseline gap-2"><dt className="font-bold uppercase text-[var(--color-hint)]">Number</dt><dd className="truncate">{idCard.number}</dd></div>
            <div className="grid min-w-0 grid-cols-[clamp(52px,22%,76px)_minmax(0,1fr)] items-baseline gap-2"><dt className="font-bold uppercase text-[var(--color-hint)]">Birth</dt><dd>{idCard.birthDate}</dd></div>
            <div className="grid min-w-0 grid-cols-[clamp(52px,22%,76px)_minmax(0,1fr)] items-baseline gap-2"><dt className="font-bold uppercase text-[var(--color-hint)]">Gender</dt><dd>{idCard.gender === 'male' ? 'Male' : 'Female'}</dd></div>
            <div className="grid min-w-0 grid-cols-[clamp(52px,22%,76px)_minmax(0,1fr)] items-baseline gap-2"><dt className="font-bold uppercase text-[var(--color-hint)]">Origin</dt><dd className="truncate">{capitalizeWords(idCard.origin)}</dd></div>
            <div className="grid min-w-0 grid-cols-[clamp(52px,22%,76px)_minmax(0,1fr)] items-baseline gap-2"><dt className="font-bold uppercase text-[var(--color-hint)]">Address</dt><dd className="flex min-w-0 items-center gap-1"><span className="truncate">{idCard.address ? capitalizeWords(idCard.address) : 'N/A'}</span>{idCard.address === null ? <span className="group relative inline-flex shrink-0"><button type="button" aria-label="Address update information" className="grid size-5 place-items-center rounded-full border border-[var(--color-gold-border)] bg-[var(--color-cream-muted)] text-[11px] font-extrabold text-[var(--color-ink)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-green-strong)]">!</button><span className="pointer-events-none absolute bottom-full right-0 z-10 mb-1 hidden w-52 rounded-md bg-[var(--color-ink)] px-2 py-1 text-right text-xs text-[var(--color-cream-text-pure)] shadow-sm group-hover:block group-focus-within:block">Go to the Tax Office to update.</span></span> : null}</dd></div>
          </dl>
        </div>
      </div>
    </section>
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
  idCard,
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
  idCard?: IdCardResponse | null | undefined;
  onClose: () => void;
}) {
  const state = life?.state;
  const [idCardOpen, setIdCardOpen] = useState(false);
  const energyDisabled = !online || Boolean(life?.pending || life?.retry || !state);

  if (idCardOpen && idCard) {
    return <IdCardDetails
      idCard={idCard}
      gender={gender}
      playerName={playerName}
      onClose={onClose}
    />;
  }

  return <DialogueFrame ariaLabel="Your character">
    <div className="flex items-center justify-between gap-2 [@media(max-width:699px)]:items-start">
      <h2 className="text-[18px] font-extrabold">Your character</h2>
      <GameButton label="Close" ariaLabel="Close profile" onClick={onClose} />
    </div>
    <>
        <div className="flex min-w-0 items-center gap-3 rounded-[14px] bg-[var(--color-success-surface-alt)] p-3 [@media(max-width:479px)]:p-2">
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            {idCard?.photoUrl ? (
              <img src={idCard.photoUrl} alt="" className="size-[68px] rounded-[14px] object-cover [border:2px_solid_var(--color-border)]" />
            ) : (
              <PlayerPortrait gender={gender} label={`${playerName}'s avatar`} className="size-[68px] rounded-[14px] [border:2px_solid_var(--color-border)]" />
            )}
            {idCard ? <button
              type="button"
              aria-label="Open ID card"
              onClick={() => setIdCardOpen(true)}
              className="grid size-10 place-items-center rounded-full border-0 bg-transparent p-0 text-[var(--color-green-strong)] hover:text-[var(--color-green-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-green-strong)]"
            ><GameIcon name="id-card" className="size-7 [stroke-width:2.1] drop-shadow-[0_1px_1px_var(--color-cream-text-pure)]" /></button> : null}
          </div>
          <div className="min-w-0">
            <h3 className="[overflow-wrap:anywhere] text-[18px] font-extrabold leading-tight text-[var(--color-ink)]">{playerName}</h3>
            <p className="mt-1 text-[14px] text-[var(--color-hint)]">{cityName}</p>
          </div>
        </div>
        <dl className="grid min-w-0 grid-cols-3 gap-1.5">
          <Stat label="Experience" value={`${xp} XP`} />
          <Stat label="Wallet" value={`$${state?.coins ?? coins}`} />
          {state ? <Stat label="Energy" value={`${state.energy}%`} /> : life ? <Stat label="Energy" value="Loading" /> : null}
        </dl>
      {state ? <div className="lg:hidden"><h3 className="font-bold">Appearance</h3><p className="text-sm [overflow-wrap:anywhere]">Hair: {state.appearance.hair} · Shirt: {state.appearance.shirt ?? 'default'} · Trousers: {state.appearance.trousers}</p></div> : null}
      {life?.error ? <p role="alert" className="text-[14px] text-[var(--color-warning)]">{life.error}</p> : null}
      {life?.retry ? <div className="flex flex-col gap-2">
        <p className="text-[13px] text-[var(--color-hint)]">The previous action may have saved. Retry to check safely.</p>
        <GameButton label="Retry previous action" disabled={!online || life.pending} onClick={() => void life.act(life.retry!)} />
      </div> : null}
      {state && life ? <EnergyDisplay
        energy={state.energy}
        onSleep={() => void life.act({ path: 'sleep', body: { key: crypto.randomUUID() } })}
        sleepDisabled={energyDisabled}
      /> : null}
      {!online && !practice ? <p className="text-[13px] text-[var(--color-hint)]" role="status">Reconnect to save changes.</p> : null}
    </>
  </DialogueFrame>;
}
