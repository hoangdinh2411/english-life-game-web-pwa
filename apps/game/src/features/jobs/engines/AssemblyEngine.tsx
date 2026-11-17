import { useState } from "react";
import type { JobTicket, JobShiftReport, JobMistakeDetail } from "@life-abroad/shared";
import { calculateJobStars } from "@life-abroad/shared";
import { GameButton } from "../../../gameplay/GameButton";

export interface AssemblyItem {
  id: string;
  name: string;
  icon: string;
  category: string;
}

export interface AssemblyEngineProps {
  ticket: JobTicket;
  availableItems: AssemblyItem[];
  userMode?: "kid" | "adult";
  onComplete: (report: JobShiftReport) => void;
}

export function AssemblyEngine({
  ticket,
  availableItems,
  userMode = "adult",
  onComplete,
}: AssemblyEngineProps) {
  const isKid = userMode === "kid";
  const [assembledIds, setAssembledIds] = useState<string[]>([]);
  const [startTime] = useState(() => Date.now());

  const handleAddItem = (item: AssemblyItem) => {
    setAssembledIds(prev => [...prev, item.id]);
  };

  const handleRemoveLast = () => {
    setAssembledIds(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setAssembledIds([]);
  };

  const handleServe = () => {
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    const target = ticket.targetSequence ?? [];
    const exclusions = ticket.exclusions ?? [];
    const mistakes: JobMistakeDetail[] = [];

    let correctCount = 0;
    // Check exclusions
    for (const excl of exclusions) {
      if (assembledIds.includes(excl)) {
        mistakes.push({
          code: "unwanted_ingredient",
          message: `Included ${excl} which the customer asked to exclude`,
          educationalNote: `'No ${excl}' or 'Hold the ${excl}' means leave it out!`,
        });
      }
    }

    // Check target matching
    for (let i = 0; i < Math.max(target.length, assembledIds.length); i++) {
      if (i < target.length && i < assembledIds.length) {
        if (target[i] === assembledIds[i]) {
          correctCount++;
        } else {
          mistakes.push({
            code: "wrong_step",
            message: `Step ${i + 1}: expected ${target[i]}, got ${assembledIds[i]}`,
          });
        }
      } else if (i < target.length) {
        mistakes.push({
          code: "missing_step",
          message: `Missing item: ${target[i]}`,
        });
      } else {
        mistakes.push({
          code: "extra_step",
          message: `Extra unexpected item: ${assembledIds[i]}`,
        });
      }
    }

    const accuracyPercent = target.length > 0 ? Math.max(0, Math.round((correctCount / target.length) * 100)) : 100;
    const penalty = mistakes.length * 20;
    const score = Math.max(0, 100 - penalty);
    const stars = calculateJobStars(score);

    // Generate random UUID for report idempotency
    const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `job-${Date.now()}-mock-uuid`;

    const report: JobShiftReport = {
      ticketId: ticket.ticketId,
      jobId: ticket.jobId,
      idempotencyKey,
      score,
      stars,
      accuracyPercent,
      mistakes,
      timeElapsedSeconds: elapsedSeconds,
      completedAt: new Date().toISOString(),
    };

    onComplete(report);
  };

  return (
    <div className="assembly-engine flex flex-col gap-3 p-1">
      {/* Customer Request Callout */}
      <div className="rounded-xl border border-[var(--color-gold-border)] bg-[var(--color-cream-muted)] p-3 text-left">
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted mb-1">
          <span>Customer:</span>
          <span className="text-ink font-extrabold">{ticket.customerName}</span>
        </div>
        <p className="text-sm font-bold text-ink italic leading-snug">
          “{ticket.orderPromptEnglish}”
        </p>
      </div>

      {/* Assembly Workstation / Visual Plate */}
      <div className="flex flex-col items-center justify-end min-h-36 rounded-2xl border-2 border-dashed border-border bg-[var(--color-paper)] p-3">
        <span className="text-xs text-muted mb-2 font-medium">
          {assembledIds.length === 0 ? "Tap ingredients below to build the order" : "Current Build:"}
        </span>
        <div className="flex flex-col-reverse items-center gap-1 min-h-16">
          {assembledIds.map((id, index) => {
            const item = availableItems.find(it => it.id === id);
            return (
              <span
                key={index}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-card px-3 py-1 text-sm font-bold shadow-xs animate-in slide-in-from-bottom-2 duration-150"
              >
                <span>{item?.icon ?? "✦"}</span>
                <span>{item?.name ?? id}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Action Controls for Workstation */}
      <div className="flex justify-between items-center px-1">
        <button
          type="button"
          onClick={handleRemoveLast}
          disabled={assembledIds.length === 0}
          className="text-xs font-bold text-[var(--color-danger)] disabled:opacity-40 hover:underline"
        >
          Undo last item
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={assembledIds.length === 0}
          className="text-xs text-muted disabled:opacity-40 hover:underline"
        >
          Clear all
        </button>
      </div>

      {/* Ingredient Selection Shelf */}
      <div className="grid grid-cols-4 gap-2 pt-1" role="region" aria-label="Ingredients shelf">
        {availableItems.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleAddItem(item)}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[var(--color-border)] bg-card p-2 text-center shadow-xs hover:border-[var(--color-gold-border)] hover:bg-[var(--color-dialogue)] active:scale-95 transition-all"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-[11px] font-bold text-ink truncate w-full">{item.name}</span>
          </button>
        ))}
      </div>

      {/* Serve Order Button */}
      <div className="pt-2">
        <GameButton
          label={isKid ? "Serve to Customer! 🍧" : "Serve Order"}
          disabled={assembledIds.length === 0}
          onClick={handleServe}
        />
      </div>
    </div>
  );
}
