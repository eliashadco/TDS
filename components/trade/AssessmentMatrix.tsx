"use client";

import ScoreRow from "@/components/trade/ScoreRow";
import MetricExplainer from "@/components/learn/MetricExplainer";
import type { TradeMode } from "@/types/trade";

export type AssessmentMatrixItem = {
  id: string;
  name: string;
  description: string;
  type: "fundamental" | "technical";
  note?: string;
  value: 0 | 1 | null;
};

type AssessmentMatrixProps = {
  metrics: AssessmentMatrixItem[];
  mode: TradeMode;
  direction: "LONG" | "SHORT";
  editable?: boolean;
  learnMode?: boolean;
  emptyMessage?: string;
  noteLabel?: string;
  onScoreChange?: (metricId: string, value: 0 | 1) => void;
};

function badgeClass(value: 0 | 1 | null): string {
  if (value === 1) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (value === 0) {
    return "bg-rose-50 text-rose-700";
  }
  return "bg-slate-100 text-slate-600";
}

function badgeLabel(value: 0 | 1 | null): string {
  if (value === 1) {
    return "Pass";
  }
  if (value === 0) {
    return "Fail";
  }
  return "Pending";
}

export default function AssessmentMatrix({
  metrics,
  mode,
  direction,
  editable = false,
  learnMode = false,
  emptyMessage = "No assessment metrics are available.",
  noteLabel = "Rationale",
  onScoreChange,
}: AssessmentMatrixProps) {
  const sections = [
    {
      key: "fundamental",
      title: "Fundamental stack",
      metrics: metrics.filter((metric) => metric.type === "fundamental"),
    },
    {
      key: "technical",
      title: "Technical stack",
      metrics: metrics.filter((metric) => metric.type === "technical"),
    },
  ] as const;

  if (metrics.length === 0) {
    return <div className="trade-review-card trade-compact-card text-sm text-tds-dim">{emptyMessage}</div>;
  }

  return (
    <div className="trade-assessment-matrix-grid">
      {sections.map((section) => {
        if (section.metrics.length === 0) {
          return null;
        }

        return (
          <section key={section.key} className="trade-assessment-section">
            <div className="trade-assessment-section-header">
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-tds-text">{section.title}</h3>
              <span className="trade-summary-pill">{section.metrics.length} checks</span>
            </div>
            <div className="trade-assessment-section-list">
            {section.metrics.map((metric) => (
              <div key={metric.id} className="space-y-2">
                {editable ? (
                  <ScoreRow
                    name={metric.name}
                    description={metric.description}
                    note={metric.note}
                    value={metric.value}
                    onChange={(value) => onScoreChange?.(metric.id, value)}
                  />
                ) : (
                  <div className="trade-review-card flex flex-wrap items-start justify-between gap-3 p-5">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-tds-text">{metric.name}</p>
                        <span className="inline-tag neutral">{metric.type}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-tds-dim">{metric.description}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim">{noteLabel}</p>
                      <p className="mt-1 text-sm leading-6 text-tds-text/80">{metric.note || "No rationale note was stored for this check."}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${badgeClass(metric.value)}`}>
                      {badgeLabel(metric.value)}
                    </span>
                  </div>
                )}
                {learnMode ? <MetricExplainer metricId={metric.id} mode={mode} direction={direction} /> : null}
              </div>
            ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}