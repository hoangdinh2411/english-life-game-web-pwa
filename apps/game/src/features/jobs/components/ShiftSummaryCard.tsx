import type { JobShiftReport } from "@life-abroad/shared";
import { GameButton } from "../../../gameplay/GameButton";

export interface ShiftSummaryCardProps {
  report: JobShiftReport;
  userMode?: "kid" | "adult";
  onFinish: () => void;
}

export function ShiftSummaryCard({ report, userMode = "adult", onFinish }: ShiftSummaryCardProps) {
  const isKid = userMode === "kid";

  return (
    <div
      role="dialog"
      aria-labelledby="shift-summary-title"
      className="flex flex-col gap-3 rounded-2xl border-2 border-[var(--color-gold-border)] bg-[var(--color-dialogue)] p-5 text-center text-ink shadow-lg animate-in zoom-in-95 duration-200"
    >
      <h3 id="shift-summary-title" className="text-xl font-extrabold text-[var(--color-green-strong)]">
        {isKid ? "🎉 Awesome Job!" : "Shift Complete"}
      </h3>

      {/* Stars Display */}
      <div className="flex justify-center gap-1.5 text-3xl" aria-label={`${report.stars} stars earned`}>
        {[1, 2, 3].map(starIndex => (
          <span
            key={starIndex}
            className={`transition-transform ${
              starIndex <= report.stars ? "scale-110 drop-shadow-sm" : "opacity-30 grayscale"
            }`}
          >
            ⭐
          </span>
        ))}
      </div>

      <div className="flex justify-center gap-4 py-1 text-sm font-bold">
        <span>Score: {report.score} / 100</span>
        <span>Accuracy: {report.accuracyPercent}%</span>
      </div>

      {/* Educational Feedback / Mistakes */}
      {report.mistakes.length > 0 ? (
        <div className="rounded-xl border border-[var(--color-warning)] bg-[var(--color-card)] p-3 text-left text-xs">
          <span className="font-bold text-[var(--color-warning)] block mb-1">
            {isKid ? "Remember for next time:" : "Order Discrepancies:"}
          </span>
          <ul className="list-disc pl-4 space-y-1 text-muted">
            {report.mistakes.map((mistake, index) => (
              <li key={index}>
                <span className="text-ink font-semibold">{mistake.message}</span>
                {mistake.educationalNote ? (
                  <p className="text-[var(--color-green-strong)] font-medium mt-0.5">
                    💡 {mistake.educationalNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm font-semibold text-[var(--color-green-strong)]">
          {isKid ? "Perfect order! Customer is delighted! ✨" : "Flawless execution! 100% customer satisfaction."}
        </p>
      )}

      <div className="pt-2">
        <GameButton
          label={isKid ? "Claim Stars & Continue ⭐" : "Complete Shift & Return"}
          onClick={onFinish}
        />
      </div>
    </div>
  );
}
