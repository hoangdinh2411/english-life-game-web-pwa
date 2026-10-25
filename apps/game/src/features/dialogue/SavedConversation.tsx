import type { ReactNode } from "react";
import { DialogueMessage } from "../../gameplay/DialogueMessage";
import { MessageComposer } from "../../gameplay/MessageComposer";
import { GameButton } from "../../gameplay/GameButton";
import { npcPortraits, playerPortraitPresentation } from "../../gameplay/portraits";
import type { PlayerGender } from "@life-abroad/shared";
import type { ConversationSnapshot } from "./conversation-controller";
import { useSavedConversation } from "./use-saved-conversation";

export function SavedConversation({
  state,
  sound,
  online,
  send,
  loadOlder,
  retry,
  displayNpc,
  gender,
  completed = false,
  details,
  hint,
  onClose,
}: {
  state: ConversationSnapshot;
  sound: boolean;
  online: boolean;
  send: (text: string) => Promise<boolean>;
  loadOlder?: () => Promise<boolean>;
  retry: () => void;
  displayNpc?: {
    name: string;
    portrait: string;
    portraitPosition: (text: string, thinking?: boolean) => string;
    portraitGrid?: { columns: number; rows: number };
  };
  gender?: PlayerGender | undefined;
  completed?: boolean;
  details?: ReactNode;
  hint?: string;
  onClose?: () => void;
}) {
  const playerPortrait = playerPortraitPresentation(gender);
  const {
    blocked,
    cancelRecording,
    history,
    hintOpen,
    onHistoryScroll,
    reveal,
    setDismissEndPrompt,
    setHintOpen,
    setText,
    showEndPrompt,
    speech,
    submit,
    text,
    toggleRecording,
    voice,
  } = useSavedConversation({
    state,
    sound,
    online,
    completed,
    send,
    ...(loadOlder ? { loadOlder } : {}),
  });
  if (showEndPrompt) {
    return (
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="End the conversation"
      >
        <span>End the conversation?</span>
        <GameButton
          label="Yes"
          onClick={() => onClose?.()}
        />
        <GameButton
          label="No"
          onClick={() => setDismissEndPrompt(true)}
        />
      </div>
    );
  }
  return (
    <>
      <div
        ref={history}
        className="conversation-history h-[min(220px,_28dvh)] min-h-16 max-h-[min(220px,_28dvh)] flex-1 overflow-y-auto overscroll-contain pr-1 [@media(max-height:480px)]:h-[120px] [@media(max-height:480px)]:max-h-[120px]"
        role="log"
        aria-label="Conversation history"
        aria-live="polite"
        onScroll={onHistoryScroll}
      >
        {state.historyLoading ? (
          <p
            role="status"
            className="text-center text-sm text-muted"
          >
            Loading earlier messages…
          </p>
        ) : null}
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
                ? playerPortrait.portrait
                : (displayNpc?.portrait ?? npcPortraits.npc_station_information)
            }
            portraitPosition={
              message.sender === "player"
                ? playerPortrait.portraitPosition
                : message.sender === "npc"
                ? displayNpc?.portraitPosition(message.text)
                : undefined
            }
            portraitGrid={
              message.sender === "player" ? playerPortrait.portraitGrid : displayNpc?.portraitGrid
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
            portrait={playerPortrait.portrait}
            portraitPosition={playerPortrait.portraitPosition}
            portraitGrid={playerPortrait.portraitGrid}
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
            portraitPosition={displayNpc?.portraitPosition(
              state.streamedReply,
              !state.streamedReply,
            )}
            portraitGrid={displayNpc?.portraitGrid}
            replayVisible={false}
          />
        ) : null}
      </div>
      {details}
      {hint ? (
        <div className="flex items-center gap-2">
          <span
            className="grid size-6 shrink-0 place-items-center rounded-full border border-[var(--color-muted-border)] bg-[var(--color-success-surface-alt)] text-[14px] cursor-pointer hover:bg- font-extrabold text-[var(--color-green-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-green-strong)]"
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
              className="dialogue-hint min-w-0 rounded-xl bg-[var(--color-success-surface-alt)] p-1 text-[var(--color-hint)] text-[14px] leading-[1.4]"
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
          className="error text-[var(--color-danger)] text-[15px] leading-[1.4]"
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
          className="error text-[var(--color-danger)] text-[15px] leading-[1.4]"
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
      <MessageComposer
        text={text}
        onChange={setText}
        onSend={() => void submit()}
        pending={blocked}
        voiceSupported={speech.supported}
        listening={speech.listening}
        onRecord={toggleRecording}
        onCancelRecording={cancelRecording}
      />
      {speech.listening ? (
        <p className="hint text-muted text-[13px] leading-[1.4]">
          Recording… Stop to review, or Send to finish.
        </p>
      ) : null}
      {speech.interim ? <p role="status">{speech.interim}</p> : null}
      {speech.error ? (
        <p
          role="alert"
          className="error text-[var(--color-danger)] text-[15px] leading-[1.4]"
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
