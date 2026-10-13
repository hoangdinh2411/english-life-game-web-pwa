import { type Appearance } from '@life-abroad/shared';
import type { LifeControls } from './useLife';
import { DialogueFrame } from '../../gameplay/DialogueFrame';
import { GameButton } from '../../gameplay/GameButton';

export function WardrobePanel({ life, online, onClose }: {
  life: LifeControls;
  online: boolean;
  onClose: () => void;
}) {
  const state = life.state;
  const disabled = !online || life.pending || Boolean(life.retry) || !state;
  const customize = (change: {
    hair?: Appearance['hair'];
    trousers?: Appearance['trousers'];
    shirtItemId?: string;
  }) => void life.act({ path: 'appearance', body: { key: crypto.randomUUID(), ...change } });

  return <DialogueFrame>
    <div className="dialogue-header flex items-center justify-between gap-2 [&_h2]:min-w-0 [&_h2]:[overflow-wrap:anywhere] [&_button]:shrink-0">
      <h2>Wardrobe</h2>
      <GameButton label="Close wardrobe" onClick={onClose} />
    </div>
    {life.error ? <p role="alert">{life.error}</p> : null}
    {!state ? <p role="status">Loading your wardrobe…</p> : <>
      <h3>My items</h3>
      {state.ownedShirts.length ? <ul className="m-0 list-disc pl-5">
        {state.ownedShirts.map(id => {
          const item = life.catalog.find(candidate => candidate.id === id);
          return item ? <li key={id}>{item.name} · 1</li> : null;
        })}
      </ul> : <p>You do not own any shirts yet.</p>}
      <h3>Appearance</h3>
      <label className="flex flex-col gap-1">Hair
        <select className="min-h-11 w-full p-2" disabled={disabled} value={state.appearance.hair}
          onChange={event => customize({ hair: event.target.value as Appearance['hair'] })}>
          {(['brown', 'black', 'blond', 'blue'] as const).map(color => <option key={color}>{color}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">Trousers
        <select className="min-h-11 w-full p-2" disabled={disabled} value={state.appearance.trousers}
          onChange={event => customize({ trousers: event.target.value as Appearance['trousers'] })}>
          {(['navy', 'charcoal', 'brown'] as const).map(color => <option key={color}>{color}</option>)}
        </select>
      </label>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,_minmax(min(100%,_180px),_1fr))]">
        {life.catalog.filter(item => state.ownedShirts.includes(item.id)).map(item => <button key={item.id}
          className="min-h-11 rounded-lg border border-[#aa8b57] p-2" disabled={disabled}
          onClick={() => customize({ shirtItemId: item.id })}>Wear {item.name}</button>)}
      </div>
    </>}
    <GameButton label="Return to game" onClick={onClose} />
  </DialogueFrame>;
}
