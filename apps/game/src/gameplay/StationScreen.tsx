import type { StationScreenProps } from "../types/ui/gameplay";
import { useCallback, useState } from "react";
import { GAME_TIME_RATE, type StationSpeaker } from "@life-abroad/shared";
import GameCanvas from "./GameCanvas";
import ConversationPanel from "./ConversationPanel";
import { DialogueFrame } from "./DialogueFrame";
import { GameButton } from "./GameButton";
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
import { VenueClosedDialogue } from "../features/location/VenueClosedDialogue";
import type { ClosedVenueLocation } from "../types/gameplay/world";
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
import { MovementTutorial } from "../features/tutorial/MovementTutorial";
import {
  movementTutorialSeen,
  tutorialReturnSurface,
  type TutorialSource,
} from "../features/tutorial/tutorial-state";
import { loadTutorialSpeech } from "../api/client";
import {
  isTaxOfficeStaff,
  TAX_OFFICE_STAFF,
  type TaxOfficeStaffId,
} from "../features/tax-office/tax-office-staff";
import { GameIcon } from "../shared/GameIcon";
import { OverlayButton } from "./OverlayButton";

type ClosedVenueNotice = Readonly<{
  location: ClosedVenueLocation;
  conversationNpcId: string | null;
}>;

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
    StationSpeaker | ShopNpcId | StreetNpcId | TaxOfficeStaffId | null
  >(null);
  const [tutorialSource, setTutorialSource] = useState<TutorialSource | null>(
    () => (movementTutorialSeen() ? null : "first-run"),
  );
  const [stationReady, setStationReady] = useState(false);
  const [location, setLocation] = useState(() =>
    countryLocationLabel(countryName, "station"),
  );
  const [menu, setMenu] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [closedVenue, setClosedVenue] = useState<ClosedVenueNotice | null>(null);
  const [closedVenueExitSignal, setClosedVenueExitSignal] = useState(0);
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
  const loadTutorialSpeechAudio = useCallback(
    (pageId: Parameters<typeof loadTutorialSpeech>[1]) =>
      runAuthenticated((token) => loadTutorialSpeech(token, pageId)),
    [runAuthenticated],
  );
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
    profileOpen ||
    closedVenue !== null ||
    goals ||
    exitReminder ||
    Boolean(arrival?.pending || arrival?.error);
  const inputOnlyOverlayOpen =
    menu || settingsOpen || reviewOpen || tutorialSource !== null;
  const overlayOpen = npcId !== null || worldPaused || inputOnlyOverlayOpen;
  const canvasPause = gameMenuCanvasState({
    inputOverlayOpen: inputOnlyOverlayOpen,
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
              onVenueClosed: (venue, conversationNpcId) =>
                setClosedVenue({ location: venue, conversationNpcId }),
              closedVenueExitSignal,
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
          if (!practice && isTaxOfficeStaff(id)) setNpcId(id);
        }}
      />
      <div
        className="station-hud pointer-events-none absolute left-[max(8px,env(safe-area-inset-left))] right-[max(8px,env(safe-area-inset-right))] top-[max(8px,env(safe-area-inset-top))] flex items-start justify-between gap-2"
        inert={Boolean(life?.sleepTransition)}
      >
        <div className="flex flex-col items-start gap-1">
          <PlayerInfoCard
            gender={gender}
            playerName={playerName}
            cityName={displayedCountryName}
            coins={coins}
            onOpenProfile={() => setProfileOpen(true)}
            visible={!overlayOpen || profileOpen}
          />
          {showGoals ? (
            <button
              type="button"
              onClick={() => setGoals(true)}
              aria-label={
                arrival
                  ? `Open saved arrival goals, ${arrival.goalsLabel}`
                  : `Open goals, ${notice.active} active quests, ${notice.fresh} new quests`
              }
              className="pointer-events-auto relative grid size-8 place-items-center rounded-lg border border-border/60 bg-[var(--color-dialogue-overlay-strong)] text-ink shadow-sm hover:bg-card sm:size-9"
            >
              <GameIcon
                name="goals"
                className="size-4 sm:size-5"
              />
              {notice.fresh > 0 ? (
                <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[var(--color-gold)] px-1 text-[10px] font-bold leading-none text-ink">
                  {notice.fresh}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>

        <aside className="pointer-events-auto flex h-8 items-center rounded-lg border border-border/60 bg-dialogue px-2 text-left shadow-sm sm:h-9">
          <span
            className="shrink-0 text-xs tabular-nums text-ink"
            aria-label={`Game time ${timeLabel}`}
          >
            <span className="inline-flex items-center gap-1">
              <GameIcon
                name="clock"
                className="size-3.5"
              />
              {timeLabel}
            </span>
          </span>
        </aside>

        <div className="station-tools pointer-events-auto flex gap-1 sm:gap-2">
          <div className="hidden lg:block">
            <OverlayButton
              label={sound ? "Sound on" : "Sound off"}
              icon={<GameIcon name={sound ? "sound-on" : "sound-off"} />}
              onClick={() => setPreference("sound", !sound)}
            />
          </div>
          {!overlayOpen || menu ? (
            <span className={menu ? "relative lg:hidden" : "relative"}>
              <OverlayButton
                label="Menu"
                icon={<GameIcon name="menu" />}
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
                  <GameIcon
                    name="sound-off"
                    className="size-3"
                  />
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
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
      {!npcId && tutorialSource === null && !goals && closedVenue === null
        ? arrival?.statusPanel
        : null}
      {closedVenue ? (
        <VenueClosedDialogue
          location={closedVenue.location}
          conversationNpcId={closedVenue.conversationNpcId}
          gameTimeAvailable={Boolean(worldClock.time)}
          onReturn={() => {
            if (closedVenue.conversationNpcId !== null) {
              setNpcId(null);
              setClosedVenueExitSignal(current => current + 1);
            }
            setClosedVenue(null);
          }}
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
      {tutorialSource && stationReady ? (
        <MovementTutorial
          playerName={playerName}
          sound={sound}
          source={tutorialSource}
          {...(!practice ? { loadSpeech: loadTutorialSpeechAudio } : {})}
          onClose={() => {
            const returnToMenu =
              tutorialReturnSurface(tutorialSource) === "menu";
            setTutorialSource(null);
            if (returnToMenu) setMenu(true);
          }}
        />
      ) : null}
      {npcId && (isStreetNpc(npcId) || isTaxOfficeStaff(npcId)) ? (
        <TownspersonConversation
          gender={gender}
          key={npcId}
          npc={
            isStreetNpc(npcId)
              ? STREET_NPCS.find((npc) => npc.id === npcId)!
              : TAX_OFFICE_STAFF.find((npc) => npc.id === npcId)!
          }
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
            setTutorialSource("menu");
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
          onBack={() => {
            setSettingsOpen(false);
            setMenu(true);
          }}
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
