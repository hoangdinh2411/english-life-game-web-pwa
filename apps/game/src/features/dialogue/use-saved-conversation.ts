import { useEffect, useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { useNarration } from "../../speech/use-narration";
import { npcVoice } from "../../speech/npc-voice";
import { useSpeech } from "../../speech/use-speech";
import type { ConversationSnapshot } from "./conversation-controller";
import {
  shouldAutomaticallyRevealNpcMessage,
  shouldRevealEntireNpcMessage,
  shouldUseTypingFallback,
  useNpcMessageReveal,
} from "./use-npc-message-reveal";

interface SavedConversationBehaviorOptions {
  state: ConversationSnapshot;
  sound: boolean;
  online: boolean;
  completed: boolean;
  send: (text: string) => Promise<boolean>;
  loadOlder?: () => Promise<boolean>;
  onNpcMessagePresented?: (messageId: string) => void;
}

export function useSavedConversation({
  state,
  sound,
  online,
  completed,
  send,
  loadOlder,
  onNpcMessagePresented,
}: SavedConversationBehaviorOptions) {
  const [text, setText] = useState(state.retryMessage?.text ?? "");
  const [hintOpen, setHintOpen] = useState(false);
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
  const spokenText = lastNpc?.speech?.text ?? lastNpc?.text ?? "";
  const voice = useNarration(
    spokenText,
    sound && !state.pending && !speech.listening,
    lastNpc?.id ?? "",
    npcVoice[state.conversation?.npcId ?? "npc_station_information"],
    state.conversation?.npcId,
    Boolean(lastNpc?.ai),
    lastNpc?.speech?.url,
    false,
  );
  const latestMessage = state.conversation?.messages.at(-1);
  const reveal = useNpcMessageReveal(
    latestMessage
      ? {
          id: latestMessage.id,
          text: latestMessage.text,
          npc:
            latestMessage.sender === "npc" &&
            shouldRevealEntireNpcMessage(latestMessage.text, latestMessage.speech?.text) &&
            shouldAutomaticallyRevealNpcMessage(
              latestMessage.id,
              state.streamedMessageId,
            ),
        }
      : null,
    voice.playback,
    shouldUseTypingFallback(sound, voice.ready, voice.error),
  );
  const narrationPending = Boolean(
    sound &&
    voice.ready &&
    !voice.error &&
    lastNpc &&
    (voice.playback.revision !== lastNpc.id || voice.playback.progress < 1),
  );
  const showEndPrompt =
    state.farewellStage === "confirm" &&
    latestMessage?.sender === "npc" &&
    !state.pending &&
    !state.streaming &&
    !reveal?.revealing &&
    !voice.speaking &&
    !narrationPending &&
    !dismissEndPrompt;
  const presentationBusy = Boolean(reveal?.revealing || voice.speaking || narrationPending);

  useEffect(() => {
    if (lastNpc && !presentationBusy) onNpcMessagePresented?.(lastNpc.id);
  }, [lastNpc, onNpcMessagePresented, presentationBusy]);

  useLayoutEffect(() => {
    const element = history.current;
    if (!element) return;
    if (previousScrollHeight.current !== null) {
      element.scrollTop = element.scrollHeight - previousScrollHeight.current;
      previousScrollHeight.current = null;
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [latestMessage?.id, state.conversation?.messages, state.streaming]);

  const submit = async (original = false): Promise<void> => {
    if (sending.current || blocked) return;
    sending.current = true;
    let clearedReply: string | null = null;
    try {
      let reply: string | null = original
        ? (state.retryMessage?.text ?? text)
        : text;
      if (speech.listening) {
        setFinalizing(true);
        reply = await speech.finish();
      }
      if (reply !== null) {
        clearedReply = reply;
        setText("");
        if (await send(reply)) {
          clearedReply = null;
          setDismissEndPrompt(false);
        } else {
          clearedReply = null;
          setText(reply);
        }
      }
    } catch (error: unknown) {
      if (clearedReply !== null) setText(clearedReply);
      throw error;
    } finally {
      sending.current = false;
      setFinalizing(false);
    }
  };

  const onHistoryScroll = (event: UIEvent<HTMLDivElement>): void => {
    const element = event.currentTarget;
    const cursor = state.conversation?.historyCursor;
    if (
      element.scrollTop > 8 ||
      !cursor?.hasMore ||
      !loadOlder ||
      state.historyLoading
    ) {
      return;
    }
    previousScrollHeight.current = element.scrollHeight;
    void loadOlder().then((loaded) => {
      if (!loaded) previousScrollHeight.current = null;
    });
  };

  const toggleRecording = (): void => {
    if (speech.listening) {
      void speech.finish();
      return;
    }
    voice.stop();
    speech.start();
  };

  const cancelRecording = (): void => {
    speech.stop();
    setText("");
  };

  return {
    blocked,
    cancelRecording,
    history,
    hintOpen,
    onHistoryScroll,
    presentationBusy,
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
  };
}
