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
import { shouldShowQuestBoard, goalNotice } from './arrival-hud';
import { usePwa } from '../pwa/PwaProvider';
export default function StationScreen({ playerName, xp, coins, onSignOut, practice = false, arrival }: StationScreenProps) {
  const [npcId, setNpcId] = useState<StationSpeaker | null>(null);
  const [tutorial, setTutorial] = useState(true);
  const [stationReady, setStationReady] = useState(false);
  const [location, setLocation] = useState('Maplewood · Train Station');
  const [menu, setMenu] = useState(false);
  const [goals, setGoals] = useState(false);
  const [sound, setSound] = useState(true);
  const [exitUnlocked, setExitUnlocked] = useState(false);
  const [exitReminder, setExitReminder] = useState(false);
  const pwa = usePwa();
  const cityName = location.split(' · ')[0] ?? 'Maplewood';
  const overlayOpen = npcId !== null || tutorial || menu || goals || exitReminder || Boolean(arrival?.pending || arrival?.error);
  const showGoals = shouldShowQuestBoard({ tutorialOpen: overlayOpen, mapReady: stationReady });
  const notice = goalNotice();
  return <main className="station-screen" aria-label={location}>
    <GameCanvas {...(arrival ? { initialLocation: arrival.initialLocation, onEnterStreet: arrival.onEnterStreet } : {})} exitUnlocked={arrival?.exitUnlocked ?? exitUnlocked} onExitBlocked={() => setExitReminder(true)} onReadyChange={setStationReady} onLocationChange={setLocation} paused={!stationReady || overlayOpen} onTalk={(id) => {
      if (id === 'npc_station_information') arrival?.onOpenReceptionist();
      if (id === 'npc_station_information' || id === 'npc_passenger_backpack' || id === 'npc_passenger_suitcase') setNpcId(id);
    }} />
    <div className="station-hud">
      <PlayerInfoCard playerName={playerName} cityName={cityName} xp={xp} coins={coins} visible={!overlayOpen} />
      <div className="station-tools">
      <OverlayButton label={sound ? 'Sound on' : 'Sound off'} icon={sound ? '🔊' : '🔇'} onClick={() => setSound(!sound)} />
      {!overlayOpen ? <OverlayButton label="Menu" icon="≡" onClick={() => setMenu(true)} /> : null}
      </div>
    </div>
    {showGoals ? <div className="goals-control"><span className="goal-notice">{notice.fresh ? `${notice.fresh} new quest${notice.fresh > 1 ? 's' : ''}` : notice.active ? `${notice.active} active quest${notice.active > 1 ? 's' : ''}` : 'Your quests'}</span><GameButton label={notice.active || notice.fresh ? '! Goals' : 'Goals'} ariaLabel={`Open goals, ${notice.active} active quests, ${notice.fresh} new quests`} onClick={() => setGoals(true)} /></div> : null}
    {goals ? <DialogueFrame><div className="dialogue-header"><h2>Goals</h2><GameButton label="Close goals" onClick={() => setGoals(false)} /></div><QuestBoard inPanel /></DialogueFrame> : null}
    {tutorial && stationReady ? <TutorialDialogue playerName={playerName} sound={sound} onClose={() => setTutorial(false)} /> : null}
    {npcId === 'npc_station_information' && arrival ? <DialogueFrame><div className="dialogue-header"><h2>Receptionist</h2><GameButton label="Close" onClick={() => setNpcId(null)} /></div>{arrival.renderReceptionist(sound)}</DialogueFrame> : npcId ? <ConversationPanel key={npcId} npcId={npcId} playerName={playerName} sound={sound} {...(practice ? { onDirections: setExitUnlocked } : {})} onClose={() => setNpcId(null)} /> : null}
    {arrival?.pending && !npcId ? <p className="practice-status" role="status">Checking your saved game…</p> : null}
    {arrival?.error && !npcId ? <DialogueFrame><p role="alert">{arrival.error}</p><GameButton label="Check saved state" onClick={arrival.onRetry} /></DialogueFrame> : null}
    {exitReminder ? <DialogueFrame><h2>Before you leave</h2><p>{arrival ? 'Greet the receptionist at the information kiosk, then ask for a bus ticket to Town Street.' : 'Talk to the receptionist at the information kiosk and ask where to get an ID card first. Look for the yellow ! marker.'}</p><GameButton label="Return to station" onClick={() => setExitReminder(false)} /></DialogueFrame> : null}
    {menu ? <DialogueFrame><h2>Game menu</h2><strong className="truncate">{playerName}</strong>
      {practice ? <p>Local practice · No saved progress or rewards.</p> : <p>XP {xp} · Coins {coins}</p>}
      <GameButton label="Movement tutorial" onClick={() => { setMenu(false); setTutorial(true); }} />
      <GameButton label="Return to game" onClick={() => setMenu(false)} />
      {pwa.updateReady ? <GameButton label="Reload to update" onClick={() => void pwa.update()} /> : null}
      <GameButton label={practice ? 'Leave local practice' : 'Sign out'} onClick={onSignOut} />
    </DialogueFrame> : null}
  </main>;
}



