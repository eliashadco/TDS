"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type ReadyTradeView = {
  id: string;
  strategyId: string | null;
  ticker: string;
  direction: "LONG" | "SHORT";
  verdict: "GO" | "CAUTION" | "SKIP";
  passRate: number;
  strategyLabel: string;
  strategyDetail: string;
  thesisSummary: string;
  triggerLevel: number | null;
  updatedAt: string | null;
  note: string;
};

type ReadyTradesCardProps = {
  items: ReadyTradeView[];
};

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return "Not saved yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTrigger(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "Planner pending";
  }

  return value.toFixed(2);
}

export default function ReadyTradesCard({ items }: ReadyTradesCardProps) {
  const readyCount = items.filter((item) => item.verdict === "GO").length;
  const queuedCount = items.filter((item) => item.verdict === "CAUTION").length;
  const leadSignal = items[0] ?? null;

  const signalSummary = leadSignal
    ? `${leadSignal.ticker} leads the board at ${Math.round(leadSignal.passRate * 100)}% fit. Trigger ${formatTrigger(leadSignal.triggerLevel)} · updated ${formatUpdatedAt(leadSignal.updatedAt)}.`
    : "Scanning for momentum continuation, event follow-through, and clean pullback structures.";

  return (
    <aside className="surface-panel monitor-panel">
      <div className="surface-header monitor-header">
        <div>
          <p className="meta-label">Signal Monitor</p>
          <h3>AI Readiness</h3>
        </div>
        <span className="signal-badge" aria-hidden="true">⚡</span>
      </div>

      <div className="mini-stats signal-stats">
        <article>
          <span className="meta-label">Ready</span>
          <strong>{readyCount.toString().padStart(2, "0")}</strong>
        </article>
        <article>
          <span className="meta-label">Watch</span>
          <strong>{queuedCount.toString().padStart(2, "0")}</strong>
        </article>
      </div>

      <div className="monitor-log">
        <p className="meta-label">Recent Signals</p>
        <p>{signalSummary}</p>
      </div>

      <Link href="/marketwatch" className="secondary-button full-width">
        Open Workbench
        <ArrowRight className="h-4 w-4" />
      </Link>
    </aside>
  );
}