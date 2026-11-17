import { useState } from "react";
import { checkGrammar, type GrammarFeedback } from "@life-abroad/shared";

export interface GrammarFeedbackTagProps {
  text: string;
}

export function GrammarFeedbackTag({ text }: GrammarFeedbackTagProps) {
  const [expanded, setExpanded] = useState(false);
  const feedback: GrammarFeedback | undefined = checkGrammar(text);

  if (!feedback) return null;

  return (
    <div className="grammar-feedback-tag mt-1 text-xs">
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-muted-border)] bg-[var(--color-success-surface)] px-2.5 py-0.5 text-left font-medium text-[var(--color-green-strong)] shadow-xs hover:bg-[var(--color-success-soft)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-green-strong)]"
        aria-expanded={expanded}
        aria-label="View grammar tip"
      >
        <span>💡 Tip:</span>
        <span className="font-bold underline decoration-dotted">{feedback.improved}</span>
      </button>

      {expanded ? (
        <div className="mt-1 rounded-lg border border-[var(--color-gold-border)] bg-[var(--color-dialogue)] p-2 text-ink shadow-sm animate-in fade-in duration-150">
          <p className="font-semibold text-[13px] text-[var(--color-green-strong)]">
            Suggested phrasing: {feedback.improved}
          </p>
          <p className="mt-0.5 text-xs text-muted leading-relaxed">
            {feedback.reason}
          </p>
        </div>
      ) : null}
    </div>
  );
}
