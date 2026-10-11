import type { StationScreenProps } from '../types/ui/gameplay';
import { useState } from 'react';
import type { StationSpeaker } from '@life-abroad/shared';
import GameCanvas from './GameCanvas';
import ConversationPanel from './ConversationPanel';
import { DialogueFrame } from './DialogueFrame';
import { GameButton } from './GameButton';
import { TutorialDialogue } from './TutorialDialogue';
import { OverlayButton } from './OverlayButton';
import { PlayerInfoCard } from './PlayerInfoCard';
import { QuestBoard } from './QuestBoard';
import { shouldShowQuestBoard, goalNotice, practiceArrivalGoals } from './arrival-hud';
import { usePwa } from '../pwa/PwaProvider';
import { LifeMenu } from '../features/life/LifeMenu';
export default function StationScreen({ playerName, xp, coins, onSignOut, practice = false, arrival, life }: StationScreenProps) {
  const [npcId, setNpcId] = useState<StationSpeaker | null>(null);
  const [tutorial, setTutorial] = useState(true);
  const [stationReady, setStationReady] = useState(false);
  const [location, setLocation] = useState('Maplewood · Train Station');
  const [menu, setMenu] = useState(false);
  const [goals, setGoals] = useState(false);
  const [sound, setSound] = useState(true);
  const [exitUnlocked, setExitUnlocked] = useState(false);
  const [practiceDirectionsAsked, setPracticeDirectionsAsked] = useState(false);
  const [exitReminder, setExitReminder] = useState(false);
  const pwa = usePwa();
  const cityName = location.split(' · ')[0] ?? 'Maplewood';
  const overlayOpen = npcId !== null || tutorial || menu || goals || exitReminder || Boolean(arrival?.pending || arrival?.error);
  const showGoals = shouldShowQuestBoard({ tutorialOpen: overlayOpen, mapReady: stationReady });
  const practiceGoals = practiceArrivalGoals(practiceDirectionsAsked);
  const notice = goalNotice(practiceGoals);
  return <main className="station-screen flex-1 min-h-0 relative bg-[#241f19] overflow-hidden" aria-label={location}>
    <GameCanvas {...(life?.state ? { appearance: life.state.appearance } : {})} {...(arrival ? { initialLocation: arrival.initialLocation, onEnterStreet: arrival.onEnterStreet } : {})} exitUnlocked={arrival?.exitUnlocked ?? exitUnlocked} onExitBlocked={() => setExitReminder(true)} onReadyChange={setStationReady} onLocationChange={setLocation} paused={!stationReady || overlayOpen || Boolean(life?.sleepTransition) || Boolean(arrival && !arrival.online)} onTalk={(id) => {
      if (id === 'npc_station_information') arrival?.onOpenReceptionist();
      if (id === 'npc_station_information' || id === 'npc_passenger_backpack' || id === 'npc_passenger_suitcase') setNpcId(id);
    }} />
    <div className="station-hud absolute [top:max(8px,_env(safe-area-inset-top))] [left:max(8px,_env(safe-area-inset-left))] [right:max(8px,_env(safe-area-inset-right))] grid [grid-template-columns:minmax(0,_1fr)_auto] [align-items:start] gap-2 pointer-events-none" inert={Boolean(life?.sleepTransition)}>
      <PlayerInfoCard playerName={playerName} cityName={cityName} xp={xp} coins={coins} visible={!overlayOpen} {...(life ? { savedTime: life.time, onSleep: () => void life.act({ path: 'sleep', body: { key: crypto.randomUUID() } }), sleepDisabled: !pwa.online || life.pending || Boolean(life.retry) || !life.state } : {})} {...(life?.state ? { energy: life.state.energy } : {})} />
      <div className="station-tools [grid-column:2] [grid-row:1] [justify-self:end] flex gap-2 pointer-events-auto [@media(max-width:479px)]:gap-1">
      <OverlayButton label={sound ? 'Sound on' : 'Sound off'} icon={sound ? '🔊' : '🔇'} onClick={() => setSound(!sound)} />
      {!overlayOpen ? <OverlayButton label="Menu" icon="≡" onClick={() => setMenu(true)} /> : null}
      </div>
    </div>
    {showGoals ? <div className="goals-control absolute [bottom:max(24px,_env(safe-area-inset-bottom))] left-3 flex flex-col items-start gap-1 [@media(max-width:479px)]:[&_.game-button]:[padding:8px_12px] [@media(max-width:479px)]:[&_.game-button]:text-[14px]"><span className="goal-notice bg-[#ffe08a] rounded-[8px] [padding:4px_8px] text-[12px] font-bold">{arrival?.goalsLabel ?? (notice.fresh ? `${notice.fresh} new quest${notice.fresh > 1 ? 's' : ''}` : notice.active ? `${notice.active} active quest${notice.active > 1 ? 's' : ''}` : 'Your quests')}</span><GameButton label={arrival ? 'Goals' : notice.active || notice.fresh ? '! Goals' : 'Goals'} ariaLabel={arrival ? 'Open saved arrival goals' : `Open goals, ${notice.active} active quests, ${notice.fresh} new quests`} onClick={() => setGoals(true)} /></div> : null}
    {goals ? <DialogueFrame><div className="dialogue-header flex items-center justify-between gap-2 [&_h2]:min-w-0 [&_h2]:[overflow-wrap:anywhere] [&_button]:shrink-0"><h2>Goals</h2><GameButton label="Close goals" onClick={() => setGoals(false)} /></div>{arrival?.questPanel ?? <QuestBoard inPanel goals={practiceGoals} />}</DialogueFrame> : null}
    {!npcId && !tutorial && !goals ? arrival?.statusPanel : null}
    {tutorial && stationReady ? <TutorialDialogue playerName={playerName} sound={sound} onClose={() => setTutorial(false)} /> : null}
    {npcId === 'npc_station_information' && arrival ? <DialogueFrame><div className="dialogue-header flex items-center justify-between gap-2 [&_h2]:min-w-0 [&_h2]:[overflow-wrap:anywhere] [&_button]:shrink-0"><h2>Receptionist</h2><GameButton label="Close" onClick={() => setNpcId(null)} /></div>{arrival.renderReceptionist(sound)}</DialogueFrame> : npcId ? <ConversationPanel key={npcId} npcId={npcId} playerName={playerName} sound={sound} {...(practice ? { onDirections: (received: boolean) => { setExitUnlocked(received); if (received) setPracticeDirectionsAsked(true); } } : {})} onClose={() => setNpcId(null)} /> : null}
    {arrival?.pending && !npcId ? <p className="practice-status shrink-0 flex items-center gap-2 flex-wrap [padding:4px_max(12px,_env(safe-area-inset-left))] bg-[#e5eddd] text-[12px] leading-[1.4] bg-[#fff0c9] [&_button]:bg-transparent [&_button]:[border:1px_solid_#8b806c] [&_button]:rounded-[8px] [&_button]:text-ink [&_button]:[padding:4px_10px]" role="status">Checking your saved game…</p> : null}
    {arrival?.error && !npcId ? <DialogueFrame><p role="alert">{arrival.error}</p><GameButton label="Check saved state" onClick={arrival.onRetry} /><GameButton label="Sign out" onClick={onSignOut} /></DialogueFrame> : null}
    {exitReminder ? <DialogueFrame><h2>Before you leave</h2><p>{arrival?.blockedExitMessage ?? 'Talk to the receptionist at the information kiosk and ask where to get an ID card first. Look for the yellow ! marker.'}</p><GameButton label="Return to station" onClick={() => setExitReminder(false)} /></DialogueFrame> : null}
    {menu ? <DialogueFrame><h2>Game menu</h2><strong className="truncate">{playerName}</strong>
      {practice ? <p>Local practice · No saved progress or rewards.</p> : <p>XP {xp} · $ {coins}</p>}
      {!practice && life ? <LifeMenu life={life} online={arrival?.online ?? pwa.online} /> : null}
      <GameButton label="Movement tutorial" onClick={() => { setMenu(false); setTutorial(true); }} />
      <GameButton label="Return to game" onClick={() => setMenu(false)} />
      {pwa.updateReady ? <GameButton label="Reload to update" onClick={() => void pwa.update()} /> : null}
      <GameButton label={practice ? 'Leave local practice' : 'Sign out'} onClick={onSignOut} />
    </DialogueFrame> : null}
    {life?.sleepTransition ? <div className={`sleep-transition fixed inset-0 z-[1000] grid place-items-center bg-[#080d12] text-card [animation:sleep-darken_2s_ease-in-out_forwards] [&.waking]:[animation:sleep-wake_2s_ease-in-out_forwards] [@media(prefers-reduced-motion:reduce)]:[animation-duration:0.01ms] [@media(prefers-reduced-motion:reduce)]:[&.waking]:[animation-duration:0.01ms]  ${life.sleepTransition}`} role="status" aria-live="polite"><span>Sleeping…</span></div> : null}
    {life?.error && !menu ? <div className="life-hud-error absolute bottom-20 left-2 right-2 p-2 bg-card text-[#843514] z-[20]" role="alert">{life.error}<button onClick={() => setMenu(true)}>Open menu</button></div> : null}
  </main>;
}
