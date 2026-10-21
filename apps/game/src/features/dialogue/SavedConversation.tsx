import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DialogueMessage } from "../../gameplay/DialogueMessage";
import { MessageComposer } from "../../gameplay/MessageComposer";
import { GameButton } from "../../gameplay/GameButton";
import { npcPortraits, playerPortrait } from "../../gameplay/portraits";
import type { ConversationSnapshot } from "./conversation-controller";
import { useNarration } from "../../speech/use-narration";
import { useSpeech } from "../../speech/use-speech";
import { npcVoice } from "../../speech/npc-voice";
import { usePreferences } from "../hud/usePreferences";
import {
  shouldUseTypingFallback,
  useNpcMessageReveal,
} from "./use-npc-message-reveal";

export function SavedConversation({
  state,
  sound,
  online,
  send,
  loadOlder,
  retry,
  displayNpc,
  completed = false,
  details,
  hint,
  onClose,
}: {
  state: ConversationSnapshot;
  sound: boolean;
  online: boolean;
  send: (text: string, coach: boolean) => Promise<boolean>;
  loadOlder?: () => Promise<boolean>;
  retry: () => void;
  displayNpc?: {
    name: string;
    portrait: string;
    portraitPosition: (text: string, thinking?: boolean) => string;
    portraitGrid?: { columns: number; rows: number };
  };
  completed?: boolean;
  details?: ReactNode;
  hint?: string;
  onClose?: () => void;
}) {
  const [text, setText] = useState(state.retryMessage?.text ?? "");
  const { coach, set } = usePreferences();
  const [feedbackOpen, setFeedbackOpen] = useState(true);
  const [hintOpen, setHintOpen] = useState(false);
  useEffect(() => {
    setFeedbackOpen(true);
  }, [coach]);
  const [finalizing, setFinalizing] = useState(false);
  const [dismissEndPrompt, setDismissEndPrompt] = useState(false);
  const sending = useRef(false);
  const history = useRef<HTMLDivElement>(null);
  const previousScrollHeight = useRef<number | null>(null);
  const speech = useSpeech(setText);
  const blocked =
    state.pending ||
    finalizing ||
    !online ||
    completed ||
    Boolean(state.conversation?.seller?.closed) ||
    !state.conversation;
  const lastNpc = state.conversation?.messages.findLast(
    (message) => message.sender === "npc",
  );
  const voice = useNarration(
    lastNpc?.text ?? "",
    sound && !state.pending && !speech.listening,
    lastNpc?.id ?? "",
    npcVoice[state.conversation?.npcId ?? "npc_station_information"],
    state.conversation?.npcId,
    Boolean(lastNpc?.ai),
    lastNpc?.speech?.url,
  );
  const latestMessage = state.conversation?.messages.at(-1);
  const reveal = useNpcMessageReveal(
    latestMessage
      ? {
          id: latestMessage.id,
          text: latestMessage.text,
          npc: latestMessage.sender === "npc",
        }
      : null,
    voice.playback,
    shouldUseTypingFallback(sound, voice.ready, voice.error),
  );
  const narrationPending = Boolean(sound && voice.ready && !voice.error && lastNpc &&
    (voice.playback.revision !== lastNpc.id || voice.playback.progress < 1));
  const showEndPrompt = state.farewellStage === "confirm" && latestMessage?.sender === "npc" &&
    !state.pending && !state.streaming && !reveal?.revealing && !voice.speaking && !narrationPending && !dismissEndPrompt;
  useEffect(() => {
    const element = history.current;
    if (!element) return;
    if (previousScrollHeight.current !== null) {
      element.scrollTop = element.scrollHeight - previousScrollHeight.current;
      previousScrollHeight.current = null;
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [state.conversation?.messages]);
  const submit = async (original = false) => {
    if (sending.current || blocked) return;
    sending.current = true;
    try {
      let reply: string | null = original
        ? (state.retryMessage?.text ?? text)
        : text;
      if (speech.listening) {
        setFinalizing(true);
        reply = await speech.finish();
      }
      const preference = original
        ? (state.retryMessage?.coach ?? coach)
        : coach;
      if (reply !== null && (await send(reply, preference))) {
        setText("");
        setDismissEndPrompt(false);
      }
    } finally {
      sending.current = false;
      setFinalizing(false);
    }
  };
  if (showEndPrompt) {
    return <div className="flex flex-wrap items-center gap-2" role="group" aria-label="End the conversation">
      <span>End the conversation?</span>
      <GameButton label="Yes" onClick={() => onClose?.()} />
      <GameButton label="No" onClick={() => setDismissEndPrompt(true)} />
    </div>;
  }
  return (
    <>
      <div
        ref={history}
        className="conversation-history h-[min(220px,_28dvh)] min-h-16 max-h-[min(220px,_28dvh)] flex-1 overflow-y-auto overscroll-contain pr-1 [@media(max-height:480px)]:h-[120px] [@media(max-height:480px)]:max-h-[120px]"
        role="log"
        aria-label="Conversation history"
        aria-live="polite"
        onScroll={(event) => {
          const element = event.currentTarget;
          const cursor = state.conversation?.historyCursor;
          if (element.scrollTop > 8 || !cursor?.hasMore || !loadOlder || state.historyLoading) return;
          previousScrollHeight.current = element.scrollHeight;
          void loadOlder().then((loaded) => {
            if (!loaded) previousScrollHeight.current = null;
          });
        }}
      >
        {state.historyLoading ? <p role="status" className="text-center text-sm text-muted">Loading earlier messages…</p> : null}
        {state.conversation?.messages.map((message) => (
          <DialogueMessage
            key={message.id}
            name={
              message.sender === "player" ? "You" : (displayNpc?.name ?? "Ruth")
            }
            text={
              !message.ai && reveal?.messageId === message.id
                ? reveal.visibleText
                : message.text
            }
            fullText={message.text}
            revealing={
              !message.ai &&
              reveal?.messageId === message.id &&
              reveal.revealing
            }
            player={message.sender === "player"}
            portrait={
              message.sender === "player"
                ? playerPortrait
                : (displayNpc?.portrait ?? npcPortraits.npc_station_information)
            }
            portraitPosition={
              message.sender === "npc"
                ? displayNpc?.portraitPosition(message.text)
                : undefined
            }
            portraitGrid={
              message.sender === "npc" ? displayNpc?.portraitGrid : undefined
            }
            onReplay={() => voice.listen(message.text, message.speech?.url)}
            replayVisible={sound && voice.supported}
            replayDisabled={
              !sound || !voice.supported || state.pending || speech.listening
            }
          />
        ))}
        {state.streaming && state.retryMessage ? (
          <DialogueMessage
            name="You"
            text={state.retryMessage.text}
            player
            portrait={playerPortrait}
          />
        ) : null}
        {state.streaming ? (
          <DialogueMessage
            name={displayNpc?.name ?? "Ruth"}
            text={state.streamedReply}
            fullText={state.streamedReply}
            revealing={Boolean(state.streamedReply)}
            thinking={!state.streamedReply}
            portrait={
              displayNpc?.portrait ?? npcPortraits.npc_station_information
            }
            portraitPosition={displayNpc?.portraitPosition(state.streamedReply, !state.streamedReply)}
            portraitGrid={displayNpc?.portraitGrid}
            replayVisible={false}
          />
        ) : null}
      </div>
      {details}
      {hint ? (
        <div className="flex items-center gap-2">
          <span
            className="grid size-6 shrink-0 place-items-center rounded-full border border-[#78917f] bg-[#e5eddf] text-[14px] cursor-pointer hover:bg- font-extrabold text-[#315749] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315749]"
            aria-label={
              hintOpen ? "Hide conversation hint" : "Show conversation hint"
            }
            aria-expanded={hintOpen}
            aria-controls="conversation-hint"
            onClick={() => setHintOpen((open) => !open)}
          >
            ?
          </span>
          {hintOpen ? (
            <p
              id="conversation-hint"
              className="dialogue-hint min-w-0 rounded-xl bg-[#e5eddf] p-1 text-[#52644f] text-[14px] leading-[1.4]"
            >
              {hint}
            </p>
          ) : null}
        </div>
      ) : null}
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
      >
        {state.announcement}
      </p>
      {!online ? (
        <p
          role="alert"
          className="error text-[#a43f34] text-[15px] leading-[1.4]"
        >
          You’re offline. Reconnect to send replies or use your ticket. Your
          draft stays here; nothing is queued.
        </p>
      ) : null}
      {state.pending && !state.streaming ? (
        <p role="status">Waiting for the server…</p>
      ) : null}
      {state.error ? (
        <p
          role="alert"
          className="error text-[#a43f34] text-[15px] leading-[1.4]"
        >
          {state.error}
        </p>
      ) : null}
      {state.retryMessage && !state.pending ? (
        <GameButton
          label="Retry previous reply"
          disabled={!online}
          onClick={() => void submit(true)}
        />
      ) : null}
      {!state.conversation && !state.pending ? (
        <GameButton
          label="Retry conversation"
          disabled={!online}
          onClick={retry}
        />
      ) : null}
      <button
        type="button"
        className="game-button hidden lg:block min-h-11 [padding:10px_16px] border-0 rounded-[12px] bg-[#315749] text-[#fff8e7] text-[15px] font-bold coach-toggle [align-self:flex-start]"
        aria-pressed={coach}
        disabled={state.pending || Boolean(state.retryMessage)}
        onClick={() => set("coach", !coach)}
      >
        {coach ? "Coach on" : "Coach off"}
      </button>
      {coach ? (
        <div className="lg:hidden">
          <GameButton
            label="Coach"
            onClick={() => setFeedbackOpen((value) => !value)}
          />
        </div>
      ) : null}
      {coach && feedbackOpen ? (
        state.correction ? (
          <aside
            className="coach-feedback flex flex-col [gap:5px] p-2.5 rounded-[12px] bg-[#e5eddf] [overflow-wrap:anywhere]"
            aria-label="Coach feedback"
          >
            <strong>A natural way to say it</strong>
            <p>{state.correction.improved}</p>
            <p className="hint text-muted text-[13px] leading-[1.4]">
              {state.correction.reason}
            </p>
          </aside>
        ) : (
          <p className="hint text-muted text-[13px] leading-[1.4]">
            Coach can offer a gentle correction after your next reply. It never
            blocks your progress.
          </p>
        )
      ) : null}
      <MessageComposer
        text={text}
        onChange={setText}
        onSend={() => void submit()}
        pending={blocked}
        voiceSupported={speech.supported}
        listening={speech.listening}
        onRecord={() => {
          if (speech.listening) void speech.finish();
          else {
            voice.stop();
            speech.start();
          }
        }}
        onCancelRecording={() => {
          speech.stop();
          setText("");
        }}
      />
      {speech.supported ? (
        <p className="hint text-muted text-[13px] leading-[1.4]">
          {speech.listening
            ? "Recording… Stop to review, or Send to finish."
            : "Voice may use an online speech service. Review before sending."}
        </p>
      ) : null}
      {speech.interim ? <p role="status">{speech.interim}</p> : null}
      {speech.error ? (
        <p
          role="alert"
          className="error text-[#a43f34] text-[15px] leading-[1.4]"
        >
          {speech.error}
        </p>
      ) : null}
      {voice.error ? (
        <p
          role="status"
          className="hint text-muted text-[13px] leading-[1.4]"
        >
          {voice.error}
        </p>
      ) : null}
    </>
  );
}
