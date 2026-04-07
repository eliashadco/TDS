"use client";

import { Button } from "@/components/ui/button";
import AIProviderBadge from "@/components/ai/AIProviderBadge";
import AssessmentMatrix from "@/components/trade/AssessmentMatrix";
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
  const fPass = fScore >= fMin;
  const tPass = tScore >= tMin;
  const shouldWatchlist = allScored && fPass && !tPass;
  const canContinue = allScored && ((fPass && tPass) || shouldWatchlist);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="fin-kicker">Step 2</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-tds-text">
            {thesis.direction === "LONG" ? "▲ Bullish assessment" : "▼ Bearish assessment"}
          </h2>
        </div>
        <span className="fin-chip font-mono text-tds-text">{thesis.ticker}</span>
      </div>

      <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">
        F needs {fMin}/{fTotal} · T needs {tMin}/{tTotal} · Direction {thesis.direction}
      </p>

      <div className="fin-card p-4 text-sm text-tds-text">
        Running score: F {fScore}/{fTotal} · T {tScore}/{tTotal}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-tds-text">Assessment matrix</h3>
          <div className="flex items-center gap-2">
            {assessmentMeta ? <AIProviderBadge meta={assessmentMeta} /> : null}
            <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={onRerun}>
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

      {error ? <p className="text-sm text-tds-red">{error}</p> : null}

      {allScored && !insight ? (
        <div className="flex justify-start">
          <Button type="button" variant="secondary" onClick={onInsight} disabled={!fPass || !tPass || insightLoading}>
            {insightLoading ? "Generating..." : "AI Insight"}
          </Button>
        </div>
      ) : null}

      {insight ? (
        <div className="fin-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="fin-chip">{insight.verdict}</span>
            <span className="text-xs text-tds-dim">AI Insight</span>
            {insightMeta ? <AIProviderBadge meta={insightMeta} /> : null}
          </div>
          <p className="text-sm text-tds-text">{insight.summary}</p>
          {insight.edge ? <p className="mt-2 text-xs text-tds-dim">Edge: {insight.edge}</p> : null}
          {insight.risks ? <p className="mt-1 text-xs text-tds-dim">Risk: {insight.risks}</p> : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button type="button" onClick={onNext} disabled={!canContinue}>
          {shouldWatchlist ? "→ Watchlist" : "Next →"}
        </Button>
      </div>
    </div>
  );
}