"use client";

import { useState } from "react";
import { getMetricExplanation } from "@/lib/learn/explanations";
import type { TradeMode } from "@/types/trade";

type MetricExplainerProps = {
  metricId: string;
  mode: TradeMode;
  direction: "LONG" | "SHORT";
};

export default function MetricExplainer({ metricId, mode, direction }: MetricExplainerProps) {
  const [open, setOpen] = useState(false);
  const explanation = getMetricExplanation(metricId);

  if (!explanation) {
    return null;
  }

  return (
    <div className="rounded-lg border border-tds-border bg-tds-input/60">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="font-mono text-xs text-tds-text">Learn</span>
        <span className="text-xs text-tds-dim">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="space-y-2 border-t border-tds-border px-3 py-3 text-xs text-tds-dim">
          <p>
            <span className="font-semibold text-tds-text">What it measures:</span> {explanation.whatItMeasures}
          </p>
          <p>
            <span className="font-semibold text-tds-text">Why it matters for {mode}:</span> {explanation.whyItMatters[mode]}
          </p>
          <p>
            <span className="font-semibold text-tds-text">PASS means:</span>{" "}
            {direction === "LONG"
              ? "current evidence supports upside conditions for this metric."
              : "current evidence supports downside conditions for this metric."}
          </p>
          <p>
            <span className="font-semibold text-tds-text">FAIL means:</span>{" "}
            {direction === "LONG"
              ? "current evidence conflicts with an upside thesis on this metric."
              : "current evidence conflicts with a downside thesis on this metric."}
          </p>
          <p>
            <span className="font-semibold text-tds-text">Example:</span> {explanation.passExample[direction]}
          </p>
        </div>
      ) : null}
    </div>
  );
}
