import type { StationScreenProps } from "../types/ui/gameplay";
import { useCallback, useState } from "react";
import { GAME_TIME_RATE, type StationSpeaker } from "@life-abroad/shared";
import GameCanvas from "./GameCanvas";
import ConversationPanel from "./ConversationPanel";
import { DialogueFrame } from "./DialogueFrame";
import { GameButton } from "./GameButton";
import { TutorialDialogue } from "./TutorialDialogue";
import { OverlayButton } from "./OverlayButton";
import { PlayerInfoCard } from "./PlayerInfoCard";
import { QuestBoard } from "./QuestBoard";
import {
  shouldShowQuestBoard,
  goalNotice,
  practiceArrivalGoals,
} from "./arrival-hud";
import { usePwa } from "../pwa/PwaProvider";
import { PlayerProfileDialogue } from "../features/life/PlayerProfileDialogue";
import { ShopConversation } from "../features/shops/ShopConversation";
import { isShopNpc, type ShopNpcId } from "../features/shops/shop-npcs";
import { StoreClosedDialogue } from "../features/shops/StoreClosedDialogue";
import type { StoreLocation } from "../types/gameplay/world";
import {
  isStreetNpc,
  STREET_NPCS,
  type StreetNpcId,
} from "../features/npcs/street-npcs";
import { TownspersonConversation } from "../features/npcs/TownspersonConversation";
import { usePreferences } from "../features/hud/usePreferences";
import { useNpcPresence } from "../features/npcs/use-npc-presence";
import { GameMenu } from "../features/game-menu/GameMenu";
import { gameMenuCanvasState } from "../features/game-menu/game-menu-state";
import { SettingsPanel } from "../features/game-menu/SettingsPanel";
import { EnglishReviewPanel } from "../features/game-menu/EnglishReviewPanel";
import { isStationSpeaker } from "../features/station/station-roster";
import { useSession } from "../session/session-provider";
import { useWorldClock } from "../features/world-clock/useWorldClock";
import { countryLocationLabel } from "../features/location/country-presentation";
import useGameClock from "../hooks/use-game-clock";
import { formatWorldTime } from "../features/world-clock/world-clock";

const TUTORIAL_KEY = "movementTutorialSeen";

function hasSeenTutorial() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "1";
  } catch {
    return false; // localStorage can fail (for example, private mode)
  }
}

function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_KEY, "1");
  } catch {
    /* ignore */
  }
}

export default function StationScreen({
  gender,
  playerName,
  countryName,
  xp,
  coins,
  onSignOut,
  practice = false,
  arrival,
  life,
}: StationScreenProps) {
  const [npcId, setNpcId] = useState<
    StationSpeaker | ShopNpcId | StreetNpcId | null
  >(null);
  const [tutorial, setTutorial] = useState(() => !hasSeenTutorial());
  const [stationReady, setStationReady] = useState(false);
  const [location, setLocation] = useState(() =>
    countryLocationLabel(countryName, "station"),
  );
  const [menu, setMenu] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [closedStore, setClosedStore] = useState<StoreLocation | null>(null);
  const [activeMapId, setActiveMapId] = useState<string>(
    arrival?.initialLocation.placeId ?? "loc_station",
  );
  const [goals, setGoals] = useState(false);
  const { sound, set: setPreference } = usePreferences();
  const closeMenu = useCallback(() => {
    setMenu(false);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>('button[aria-label="Menu"]')
        ?.focus();
    });
  }, []);
  const [exitUnlocked, setExitUnlocked] = useState(false);
  const [practiceDirectionsAsked, setPracticeDirectionsAsked] = useState(false);
  const [exitReminder, setExitReminder] = useState(false);
  const pwa = usePwa();
  const { runAuthenticated } = useSession();
  const worldClock = useWorldClock(runAuthenticated, !practice);
  const presence = useNpcPresence(
    activeMapId,
    !practice && Boolean(worldClock.snapshot),
    pwa.online,
    worldClock.clockRate,
    worldClock.revision,
  );
  const displayedCountryName = countryName?.trim() || "Not selected";
  const worldPaused =
    tutorial ||
    profileOpen ||
    closedStore !== null ||
    goals ||
    exitReminder ||
    Boolean(arrival?.pending || arrival?.error);
  const inputOnlyOverlayOpen = menu || settingsOpen || reviewOpen;
  const overlayOpen = npcId !== null || worldPaused || inputOnlyOverlayOpen;
  const canvasPause = gameMenuCanvasState({
    menuOpen: inputOnlyOverlayOpen,
    worldBlockerOpen:
      !stationReady ||
      worldPaused ||
      Boolean(life?.sleepTransition) ||
      Boolean(arrival && !arrival.online),
  });
  const showGoals = shouldShowQuestBoard({
    tutorialOpen: overlayOpen,
    mapReady: stationReady,
  });
  const practiceGoals = practiceArrivalGoals(practiceDirectionsAsked);
  const notice = goalNotice(practiceGoals);
  const rate = worldClock.clockRate ?? GAME_TIME_RATE;
  const practiceTime = useGameClock(rate);
  const gameTime = worldClock.time ?? practiceTime;
  const resolvedTimeZone =
    worldClock.timeZone ??
    (worldClock.time !== undefined
      ? "UTC"
      : Intl.DateTimeFormat().resolvedOptions().timeZone);
  const timeLabel =
    worldClock.time === null
      ? "Syncing…"
      : formatWorldTime(gameTime, resolvedTimeZone);
  return (
    <main
      className="flex-1 min-h-0 relative bg-[var(--color-dark-surface)] overflow-hidden"
      aria-label={location}
    >
      <GameCanvas
        gender={gender}
        countryName={countryName}
        minimapVisible={!overlayOpen && !life?.sleepTransition}
        {...(life?.state ? { appearance: life.state.appearance } : {})}
        {...(arrival
          ? {
              initialLocation: arrival.initialLocation,
              onEnterStreet: arrival.onEnterStreet,
              onPlaceChange: arrival.onPlaceChange,
            }
          : {})}
        exitUnlocked={arrival?.exitUnlocked ?? exitUnlocked}
        onExitBlocked={() => setExitReminder(true)}
        onReadyChange={setStationReady}
        onLocationChange={setLocation}
        onMapChange={setActiveMapId}
        presentNpcIds={presence.presentNpcIds}
        {...(!practice && life
          ? {
              getGameTime: () => worldClock.time,
              getTimeZone: () => worldClock.timeZone,
              onStoreClosed: (store) => setClosedStore(store),
            }
          : {})}
        conversationNpcId={npcId}
        worldPaused={canvasPause.worldPaused}
        paused={canvasPause.playerInputPaused || npcId !== null}
        onTalk={(id) => {
          if (id === "npc_station_information") arrival?.onOpenReceptionist();
          if (isStationSpeaker(id)) setNpcId(id);
          if (!practice && isShopNpc(id)) setNpcId(id);
          if (!practice && isStreetNpc(id)) setNpcId(id);
        }}
      />
      <div
        className="station-hud absolute [top:max(8px,_env(safe-area-inset-top))] [left:max(8px,_env(safe-area-inset-left))] [right:max(8px,_env(safe-area-inset-right))] grid [grid-template-columns:minmax(0,_1fr)_auto] [align-items:start] gap-2 pointer-events-none"
        inert={Boolean(life?.sleepTransition)}
      >
        <PlayerInfoCard
          gender={gender}
          playerName={playerName}
          cityName={displayedCountryName}
          coins={coins}
          onOpenProfile={() => setProfileOpen(true)}
          visible={!overlayOpen || profileOpen}
        />
        <aside className="absolute top-0 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-md border-2 border-border bg-dialogue p-1 text-left shadow-[0_2px_6px_var(--color-shadow)]">
          <span
            className="shrink-0 text-xs tabular-nums text-ink"
            aria-label={`Game time ${timeLabel}`}
          >
            ◷ {timeLabel}
          </span>
        </aside>
        <div className="station-tools [grid-column:2] [grid-row:1] [justify-self:end] flex gap-2 pointer-events-auto [@media(max-width:479px)]:gap-1">
          <div className="hidden lg:block">
            <OverlayButton
              label={sound ? "Sound on" : "Sound off"}
              icon={sound ? "🔊" : "🔇"}
              onClick={() => setPreference("sound", !sound)}
            />
          </div>
          {!overlayOpen || menu ? (
            <span className={menu ? "relative lg:hidden" : "relative"}>
              <OverlayButton
                label="Menu"
                icon="≡"
                onClick={() => {
                  if (menu) closeMenu();
                  else setMenu(true);
                }}
              />
              {!sound ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-0.5 -right-0.5 rounded-full bg-dialogue text-[10px] lg:hidden"
                >
                  🔇
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
      {showGoals ? (
        <div className="goals-control absolute [bottom:max(24px,_env(safe-area-inset-bottom))] left-3 flex flex-col items-start gap-1 [@media(max-width:479px)]:[&_.game-button]:[padding:8px_12px] [@media(max-width:479px)]:[&_.game-button]:text-[14px]">
          <button type="button" onClick={() => setGoals(true)} aria-label={arrival ? `Open saved arrival goals, ${arrival.goalsLabel}` : 'Open goals'} className="flex min-h-11 items-center gap-1.5 rounded-xl border-0 bg-[var(--color-green-strong)] px-3 py-1 text-[13px] font-bold text-[var(--color-cream-text)] lg:hidden">
            Goals <span className="rounded-md bg-[var(--color-gold)] px-1.5 py-1 text-[10px] text-ink">{arrival?.goalsLabel ?? (notice.fresh ? `${notice.fresh} new` : notice.active ? `${notice.active} active` : 'Your quests')}</span>
          </button>
          <div className="hidden lg:flex flex-col items-start gap-1">
          <span className="goal-notice bg-[var(--color-gold)] rounded-[8px] [padding:4px_8px] text-[12px] font-bold">
            {arrival?.goalsLabel ??
              (notice.fresh
                ? `${notice.fresh} new quest${notice.fresh > 1 ? "s" : ""}`
                : notice.active
                  ? `${notice.active} active quest${notice.active > 1 ? "s" : ""}`
                  : "Your quests")}
          </span>
          <GameButton
            label={
              arrival
                ? "Goals"
                : notice.active || notice.fresh
                  ? "! Goals"
                  : "Goals"
            }
            ariaLabel={
              arrival
                ? "Open saved arrival goals"
                : `Open goals, ${notice.active} active quests, ${notice.fresh} new quests`
            }
           onClick={() => setGoals(true)}
          />
          </div>
        </div>
      ) : null}
      {goals ? (
        <DialogueFrame>
          <div className="dialogue-header flex items-center justify-between gap-2 [&_h2]:min-w-0 [&_h2]:[overflow-wrap:anywhere] [&_button]:shrink-0">
            <h2>Goals</h2>
            <GameButton
              label="Close goals"
              onClick={() => setGoals(false)}
            />
          </div>
          {arrival?.questPanel ?? (
            <QuestBoard
              inPanel
              goals={practiceGoals}
            />
          )}
        </DialogueFrame>
      ) : null}
      {!npcId && !tutorial && !goals && closedStore === null
        ? arrival?.statusPanel
        : null}
      {closedStore ? (
        <StoreClosedDialogue
          location={closedStore}
          gameTimeAvailable={Boolean(worldClock.time)}
          onReturn={() => setClosedStore(null)}
        />
      ) : null}
      {profileOpen ? (
        <PlayerProfileDialogue
          gender={gender}
          playerName={playerName}
          cityName={displayedCountryName}
          xp={xp}
          coins={coins}
          {...(life ? { life } : {})}
          online={arrival?.online ?? pwa.online}
          practice={practice}
          onClose={() => setProfileOpen(false)}
        />
      ) : null}
      {tutorial && stationReady ? (
        <TutorialDialogue
          playerName={playerName}
          countryName={countryName}
          sound={sound}
          onClose={() => {
            markTutorialSeen();
            setTutorial(false);
          }}
        />
      ) : null}
      {npcId && isStreetNpc(npcId) ? (
        <TownspersonConversation
          gender={gender}
          key={npcId}
          npc={STREET_NPCS.find((npc) => npc.id === npcId)!}
          sound={sound}
          countryName={countryName}
          onClose={() => setNpcId(null)}
          onRefresh={async () => {
            await life?.refresh();
            await worldClock.refresh();
            await presence.refresh();
          }}
        />
      ) : npcId && isShopNpc(npcId) ? (
        <ShopConversation
          gender={gender}
          key={npcId}
          npcId={npcId}
          sound={sound}
          onClose={() => setNpcId(null)}
          onRefresh={async () => {
            await life?.refresh();
            await worldClock.refresh();
            await presence.refresh();
          }}
        />
      ) : npcId === "npc_station_information" && arrival ? (
        <DialogueFrame
          soundControl={!arrival.farewellConfirm}
          confirmationOnly={arrival.farewellConfirm}
        >
          {!arrival.farewellConfirm ? (
            <div className="dialogue-header flex items-center justify-between gap-2 [&_h2]:min-w-0 [&_h2]:[overflow-wrap:anywhere] [&_button]:shrink-0">
              <h2>Ruth</h2>
            </div>
          ) : null}
          {arrival.renderReceptionist(sound, () => setNpcId(null))}
        </DialogueFrame>
      ) : npcId ? (
        <ConversationPanel
          gender={gender}
          key={npcId}
          npcId={npcId}
          playerName={playerName}
          sound={sound}
          {...(practice
            ? {
                onDirections: (received: boolean) => {
                  setExitUnlocked(received);
                  if (received) setPracticeDirectionsAsked(true);
                },
              }
            : {})}
          onClose={() => setNpcId(null)}
        />
      ) : null}
      {arrival?.pending && !npcId ? (
        <p
          className="practice-status shrink-0 flex items-center gap-2 flex-wrap [padding:4px_max(12px,_env(safe-area-inset-left))] bg-[var(--color-practice-surface)] text-[12px] leading-[1.4] [&_button]:bg-transparent [&_button]:[border:1px_solid_var(--color-border)] [&_button]:rounded-[8px] [&_button]:text-ink [&_button]:[padding:4px_10px]"
          role="status"
        >
          Checking your saved game…
        </p>
      ) : null}
      {arrival?.error && !npcId ? (
        <DialogueFrame>
          <p role="alert">{arrival.error}</p>
          <GameButton
            label="Check saved state"
            onClick={arrival.onRetry}
          />
          <GameButton
            label="Sign out"
            onClick={onSignOut}
          />
        </DialogueFrame>
      ) : null}
      {exitReminder ? (
        <DialogueFrame>
          <h2>Before you leave</h2>
          <p>
            {arrival?.blockedExitMessage ??
              "Talk to the receptionist at the information kiosk and ask where to get an ID card first. Look for the yellow ! marker."}
          </p>
          <GameButton
            label="Return to station"
            onClick={() => setExitReminder(false)}
          />
        </DialogueFrame>
      ) : null}
      {menu ? (
        <GameMenu
          practice={practice}
          onOpenReview={() => {
            setMenu(false);
            setReviewOpen(true);
          }}
          onOpenTutorial={() => {
            setMenu(false);
            setTutorial(true);
          }}
          onSignOut={onSignOut}
          onReturnToGame={closeMenu}
          onOpenSettings={() => {
            setMenu(false);
            setSettingsOpen(true);
          }}
          {...(pwa.updateReady ? { onUpdate: () => void pwa.update() } : {})}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsPanel
          practice={practice}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {reviewOpen ? (
        <EnglishReviewPanel
          onClose={() => {
            setReviewOpen(false);
            setMenu(true);
          }}
        />
      ) : null}
      {life?.sleepTransition ? (
        <div
          className={`sleep-transition fixed inset-0 z-[1000] grid place-items-center bg-[var(--color-sleep-overlay)] text-card [animation:sleep-darken_750ms_ease-in-out_forwards] [&.resting]:opacity-100 [&.resting]:[animation:none] [&.waking]:[animation:sleep-wake_750ms_ease-in-out_forwards] [@media(prefers-reduced-motion:reduce)]:[animation-duration:100ms] [@media(prefers-reduced-motion:reduce)]:[&.waking]:[animation-duration:100ms] ${life.sleepTransition}`}
          role="status"
          aria-live="polite"
        >
          <span>Taking a quick rest…</span>
        </div>
      ) : null}
      {life?.error && !menu ? (
        <div
          className="life-hud-error absolute bottom-20 left-2 right-2 p-2 bg-card text-[var(--color-warning)] z-[20]"
          role="alert"
        >
          {life.error}
          <button onClick={() => setMenu(true)}>Open menu</button>
        </div>
      ) : null}
    </main>
  );
}
