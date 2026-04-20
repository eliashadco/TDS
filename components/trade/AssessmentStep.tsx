"use client";

import { Button } from "@/components/ui/button";
import AIProviderBadge from "@/components/ai/AIProviderBadge";
import AssessmentMatrix from "@/components/trade/AssessmentMatrix";
import { cn } from "@/lib/utils";
import type { AIInsight, Metric, TradeNotes, TradeScores, TradeThesis } from "@/types/trade";
import { useLearnMode } from "@/components/learn/LearnModeContext";
import type { TradeMode } from "@/types/trade";
import type { AIResponseMeta } from "@/lib/ai/response";

type AssessmentStepProps = {
  thesis: TradeThesis;
  mode: TradeMode;
  metrics: Metric[];
  scores: TradeScores;
  notes: TradeNotes;
  loading: boolean;
  error: string | null;
  assessmentMeta: AIResponseMeta | null;
  insight: AIInsight | null;
  insightMeta: AIResponseMeta | null;
  insightLoading: boolean;
  onBack: () => void;
  onRerun: () => void;
  onScoreChange: (metricId: string, value: 0 | 1) => void;
  onInsight: () => void;
  onNext: () => void;
};

function needsCount(total: number, type: "fundamental" | "technical") {
  if (type === "technical") {
    return total;
  }
  return Math.max(1, Math.ceil(total * 0.7));
}

export default function AssessmentStep({
  thesis,
  mode,
  metrics,
  scores,
  notes,
  loading,
  error,
  assessmentMeta,
  insight,
  insightMeta,
  insightLoading,
  onBack,
  onRerun,
  onScoreChange,
  onInsight,
  onNext,
}: AssessmentStepProps) {
  const { learnMode } = useLearnMode();
  const fundamentals = metrics.filter((metric) => metric.type === "fundamental");
  const technicals = metrics.filter((metric) => metric.type === "technical");
  const matrixItems = metrics.map((metric) => ({
    id: metric.id,
    name: metric.name,
    description: metric.description,
    type: metric.type,
    note: notes[metric.id],
    value: scores[metric.id] ?? null,
  }));

  const fTotal = fundamentals.length;
  const tTotal = technicals.length;
  const fMin = needsCount(fTotal, "fundamental");
  const tMin = needsCount(tTotal, "technical");

  const fScore = fundamentals.reduce((sum, metric) => sum + (scores[metric.id] ?? 0), 0);
  const tScore = technicals.reduce((sum, metric) => sum + (scores[metric.id] ?? 0), 0);
  const allScored = metrics.every((metric) => scores[metric.id] === 0 || scores[metric.id] === 1);
  const pendingCount = metrics.length - Object.values(scores).filter((value) => value === 0 || value === 1).length;
  const fPass = fScore >= fMin;
  const tPass = tScore >= tMin;
  const shouldWatchlist = allScored && fPass && !tPass;
  const canContinue = allScored && ((fPass && tPass) || shouldWatchlist);

  return (
    <div className="space-y-5">
      <div className="trade-step-hero trade-assessment-hero">
        <div className="trade-step-hero-copy">
          <p className="meta-label">Step 2</p>
          <h2>
            {thesis.direction === "LONG" ? "▲ Bullish assessment" : "▼ Bearish assessment"}
          </h2>
          <p>Score the evidence against the active strategy, resolve pending checks, and move forward only when the gate math is complete.</p>
        </div>
        <span className="trade-summary-pill">{thesis.ticker}</span>
      </div>

      <div className="trade-assessment-desk">
        <div className="trade-assessment-main-stack">
          <div className="trade-assessment-kpi-grid">
            <article className="trade-kpi-card trade-assessment-kpi-card">
              <p className="meta-label">Fundamental Gate</p>
              <strong>{fScore}/{fTotal}</strong>
              <span>Needs {fMin} to pass</span>
            </article>
            <article className="trade-kpi-card trade-assessment-kpi-card">
              <p className="meta-label">Technical Gate</p>
              <strong>{tScore}/{tTotal}</strong>
              <span>Needs {tMin} to pass</span>
            </article>
            <article className="trade-kpi-card trade-assessment-kpi-card">
              <p className="meta-label">Window Status</p>
              <strong>{pendingCount > 0 ? `${pendingCount} pending` : shouldWatchlist ? "Watchlist" : canContinue ? "Ready" : "Review"}</strong>
              <span>{shouldWatchlist ? "Fundamentals pass, technicals still lag." : canContinue ? "Assessment can advance." : "Complete every metric first."}</span>
            </article>
          </div>

          <p className="trade-assessment-ruleline">
            F needs {fMin}/{fTotal} · T needs {tMin}/{tTotal} · Direction {thesis.direction}
          </p>

          <div className={cn("trade-running-score-card", loading && "mechanical-pulse-shell")}>
            Running score: F {fScore}/{fTotal} · T {tScore}/{tTotal}
          </div>

          <div className={cn("trade-assessment-shell", loading && "mechanical-pulse-shell")}>
            <div className="trade-assessment-toolbar">
              <h3 className="trade-assessment-heading">Assessment matrix</h3>
              <div className="trade-assessment-actions">
                {assessmentMeta ? <AIProviderBadge meta={assessmentMeta} /> : null}
                <span className={cn("trade-assessment-status", loading && "mechanical-pulse-tag")}>{loading ? "Assessing live" : "AI ready"}</span>
                <Button type="button" variant="secondary" size="sm" className="secondary-button" disabled={loading} onClick={onRerun}>
                  {loading ? "Re-running..." : "Re-run AI"}
                </Button>
              </div>
            </div>
            <AssessmentMatrix
              metrics={matrixItems}
              mode={mode}
              direction={thesis.direction}
              editable
              learnMode={learnMode}
              onScoreChange={onScoreChange}
            />
          </div>

          {error ? <div className="trade-warning-panel text-sm text-tds-text">{error}</div> : null}
        </div>

        <aside className="trade-assessment-side-rail">
          <article className="trade-review-card trade-compact-card">
            <p className="meta-label">Decision Rail</p>
            <div className="assessment-list compact">
              <div>
                <span>Fundamentals</span>
                <strong className={fPass ? "text-tds-green" : "text-tds-amber"}>{fPass ? "Pass" : "Review"}</strong>
              </div>
              <div>
                <span>Technicals</span>
                <strong className={tPass ? "text-tds-green" : "text-tds-amber"}>{tPass ? "Pass" : "Review"}</strong>
              </div>
              <div>
                <span>Pending checks</span>
                <strong>{pendingCount}</strong>
              </div>
              <div>
                <span>Outcome</span>
                <strong>{shouldWatchlist ? "Watchlist" : canContinue ? "Ready for sizing" : "Hold"}</strong>
              </div>
            </div>
          </article>

          {allScored && !insight ? (
            <article className="trade-review-card trade-compact-card">
              <p className="meta-label">AI Summary</p>
              <p className="trade-thesis-summary-empty">Once the matrix is complete, generate an AI insight to summarize edge and risk before sizing.</p>
              <div className="mt-4">
                <Button type="button" variant="secondary" className="secondary-button" onClick={onInsight} disabled={!fPass || !tPass || insightLoading}>
                  {insightLoading ? "Generating..." : "AI Insight"}
                </Button>
              </div>
            </article>
          ) : null}

          {insight ? (
            <div className="trade-review-card trade-insight-card">
              <div className="mb-2 flex items-center gap-2">
                <span className="trade-summary-pill">{insight.verdict}</span>
                <span className="text-xs text-tds-dim">AI Insight</span>
                {insightMeta ? <AIProviderBadge meta={insightMeta} /> : null}
              </div>
              <p className="text-sm text-tds-text">{insight.summary}</p>
              {insight.edge ? <p className="mt-2 text-xs text-tds-dim">Edge: {insight.edge}</p> : null}
              {insight.risks ? <p className="mt-1 text-xs text-tds-dim">Risk: {insight.risks}</p> : null}
            </div>
          ) : null}

          {learnMode ? (
            <article className="trade-review-card trade-compact-card text-sm text-tds-dim">
              <p className="meta-label">Assessment Note</p>
              <p className="mt-3">Keep the matrix mechanical: mark each check against observable evidence, not conviction or preference.</p>
            </article>
          ) : null}
        </aside>
        </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onBack}>
          ← Back
        </Button>
        <Button type="button" className="primary-button" onClick={onNext} disabled={!canContinue}>
          {shouldWatchlist ? "→ Watchlist" : "Next →"}
        </Button>
      </div>
    </div>
  );
}