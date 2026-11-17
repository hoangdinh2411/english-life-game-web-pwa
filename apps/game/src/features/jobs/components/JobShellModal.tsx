import { useState } from "react";
import type { JobTicket, JobShiftReport } from "@life-abroad/shared";
import { getJobDefinition } from "../registry/job-registry";
import { AssemblyEngine } from "../engines/AssemblyEngine";
import { ICE_CREAM_INGREDIENTS } from "../sample-configs/ice-cream.config";
import { ShiftSummaryCard } from "./ShiftSummaryCard";
import { GameIcon } from "../../../shared/GameIcon";

export interface JobShellModalProps {
  ticket: JobTicket;
  userMode?: "kid" | "adult";
  onClose: () => void;
  onJobFinish: (report: JobShiftReport) => void;
}

export function JobShellModal({
  ticket,
  userMode = "adult",
  onClose,
  onJobFinish,
}: JobShellModalProps) {
  const [report, setReport] = useState<JobShiftReport | null>(null);
  const jobDef = getJobDefinition(ticket.jobId);

  const handleReportComplete = (generatedReport: JobShiftReport) => {
    setReport(generatedReport);
  };

  const handleFinish = () => {
    if (report) {
      onJobFinish(report);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-modal-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(0,0,0,0.65)] p-3 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-3xl border-2 border-[var(--color-gold-border)] bg-[var(--color-dialogue)] p-4 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2">
          <div>
            <h2 id="job-modal-title" className="text-base font-extrabold text-ink leading-tight">
              {jobDef?.title ?? "Work Shift"}
            </h2>
            <span className="text-xs text-[var(--color-green-strong)] font-semibold">
              {jobDef?.stationName ?? "Shift Station"}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-muted hover:text-ink hover:bg-[var(--color-paper)] transition-colors"
            aria-label="Exit job minigame"
          >
            <GameIcon name="x" className="size-4" />
          </button>
        </div>

        {/* Modal Body: Active Minigame or Result Summary */}
        {report ? (
          <ShiftSummaryCard report={report} userMode={userMode} onFinish={handleFinish} />
        ) : (
          <AssemblyEngine
            ticket={ticket}
            availableItems={ICE_CREAM_INGREDIENTS}
            userMode={userMode}
            onComplete={handleReportComplete}
          />
        )}
      </div>
    </div>
  );
}
