import { useState } from "react";
import { GameIcon } from "../../shared/GameIcon";
import { ComposerIcon } from "../../gameplay/ComposerIcon";
import { UI_COLORS } from "../../styles/colors";

export interface WordCard {
  id: string;
  text: string;
  icon?: string;
  category: "quantity" | "item" | "flavor" | "polite";
}

export const DEFAULT_KID_WORD_CARDS: WordCard[] = [
  { id: "wc_one", text: "One", icon: "1️⃣", category: "quantity" },
  { id: "wc_two", text: "Two", icon: "2️⃣", category: "quantity" },
  { id: "wc_strawberry", text: "Strawberry", icon: "🍓", category: "flavor" },
  { id: "wc_chocolate", text: "Chocolate", icon: "🍫", category: "flavor" },
  { id: "wc_ice_cream", text: "Ice cream", icon: "🍦", category: "item" },
  { id: "wc_coffee", text: "Coffee", icon: "☕", category: "item" },
  { id: "wc_please", text: "Please", icon: "🙏", category: "polite" },
  { id: "wc_thank_you", text: "Thank you", icon: "✨", category: "polite" },
];

export interface KidDialogueInputProps {
  assembledText: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onRecord: () => void;
  onCancelRecording: () => void;
  listening: boolean;
  pending: boolean;
  voiceSupported: boolean;
  onSpeakWord?: (word: string) => void;
  cards?: WordCard[];
}

export function KidDialogueInput({
  assembledText,
  onChangeText,
  onSend,
  onRecord,
  onCancelRecording,
  listening,
  pending,
  voiceSupported,
  onSpeakWord,
  cards = DEFAULT_KID_WORD_CARDS,
}: KidDialogueInputProps) {
  const [showKeyboard, setShowKeyboard] = useState(false);

  const handleCardClick = (card: WordCard) => {
    onSpeakWord?.(card.text);
    const trimmed = assembledText.trim();
    const next = trimmed ? `${trimmed} ${card.text}` : card.text;
    onChangeText(next);
  };

  const handleClear = () => {
    onChangeText("");
  };

  return (
    <div className="kid-dialogue-input flex flex-col gap-2 rounded-2xl border-2 border-[var(--color-gold-border)] bg-[var(--color-cream-text-pure)] p-3 shadow-md">
      {/* 3-Star Header */}
      <div className="flex items-center justify-between px-1">
        <span className="flex items-center gap-1 text-sm font-extrabold text-[var(--color-warning)]" aria-label="3 Star Goal">
          <span>⭐</span>
          <span>⭐</span>
          <span>⭐</span>
          <span className="ml-1 text-xs font-bold text-ink">Speak in English!</span>
        </span>
        <button
          type="button"
          onClick={() => setShowKeyboard(prev => !prev)}
          className="text-xs font-semibold text-muted underline hover:text-ink"
        >
          {showKeyboard ? "Hide Keyboard" : "Type instead"}
        </button>
      </div>

      {/* Assembled Sentence Display */}
      <div className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-[var(--color-gold-border)] bg-[var(--color-paper)] px-3 py-1">
        <div className="min-w-0 flex-1 overflow-x-auto text-base font-bold text-ink">
          {assembledText ? (
            <span>{assembledText}</span>
          ) : (
            <span className="text-muted font-normal italic">Tap cards or hold Mic to speak…</span>
          )}
        </div>
        {assembledText ? (
          <button
            type="button"
            onClick={handleClear}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:text-ink"
            aria-label="Clear words"
          >
            <GameIcon name="x" className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Optional Free-text Fallback Keyboard Input */}
      {showKeyboard ? (
        <textarea
          rows={1}
          value={assembledText}
          onChange={e => onChangeText(e.target.value)}
          placeholder="Type here…"
          className="w-full rounded-xl border border-border p-2 text-ink text-sm outline-none resize-none"
        />
      ) : null}

      {/* Horizontal Tray of Illustrated Word Cards */}
      <div
        className="flex gap-2 overflow-x-auto py-1 overscroll-contain no-scrollbar"
        role="region"
        aria-label="Word Cards"
      >
        {cards.map(card => (
          <button
            key={card.id}
            type="button"
            onClick={() => handleCardClick(card)}
            disabled={pending}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-[var(--color-gold-border)] bg-card px-3 py-2 text-sm font-bold text-ink shadow-xs hover:scale-105 active:scale-95 transition-transform"
          >
            {card.icon ? <span className="text-base">{card.icon}</span> : null}
            <span>{card.text}</span>
          </button>
        ))}
      </div>

      {/* Central Large Push-to-Talk & Action Buttons */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex-1">
          {assembledText.trim() ? (
            <button
              type="button"
              onClick={onSend}
              disabled={pending}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--color-green-strong)] bg-[var(--color-green-strong)] px-4 font-bold text-white shadow-sm hover:opacity-90 active:scale-98 transition-transform"
            >
              <GameIcon name="check" className="size-5" />
              <span>Send Reply</span>
            </button>
          ) : (
            <p className="text-xs text-muted text-center">Tap cards to assemble your reply</p>
          )}
        </div>

        {voiceSupported ? (
          <button
            type="button"
            onClick={listening ? onCancelRecording : onRecord}
            disabled={pending}
            className={`grid size-14 shrink-0 place-items-center rounded-full border-3 shadow-md transition-all ${
              listening
                ? "border-[var(--color-danger)] bg-[var(--color-danger)] text-white animate-pulse"
                : "border-[var(--color-gold-border)] bg-[var(--color-gold)] text-ink hover:scale-105"
            }`}
            aria-label={listening ? "Stop listening" : "Press & Speak"}
          >
            <ComposerIcon
              kind={listening ? "stop" : "microphone"}
              color={listening ? UI_COLORS.creamTextPure : UI_COLORS.ink}
            />
          </button>
        ) : null}
      </div>
    </div>
  );
}
