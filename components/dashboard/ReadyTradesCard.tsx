"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type ReadyTradeView = {
  id: string;
  strategyId: string | null;
  ticker: string;
  direction: "LONG" | "SHORT";
  strategyLabel: string;
  strategyDetail: string;
  thesisSummary: string;
  triggerLevel: number | null;
  updatedAt: string | null;
  /** Row ordering from watchlist `flagged_at` */
  flaggedAt: string | null;
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
  const queueDepth = items.length;
  const withTrigger = items.filter((item) => item.triggerLevel != null && Number.isFinite(item.triggerLevel)).length;
  const leadSignal = items[0] ?? null;

  const signalSummary = leadSignal
    ? `${leadSignal.ticker} · trigger ${formatTrigger(leadSignal.triggerLevel)} · updated ${formatUpdatedAt(leadSignal.updatedAt)}.`
    : "Save candidates from MarketWatch to populate your execution queue.";

  return (
    <aside className="surface-panel monitor-panel">
      <div className="surface-header monitor-header">
        <div>
          <p className="meta-label">Workbench queue</p>
          <h3>Execution candidates</h3>
        </div>
        <span className="signal-badge" aria-hidden="true">
          ⚡
        </span>
      </div>

      <div className="mini-stats signal-stats">
        <article>
          <span className="meta-label">Queued</span>
          <strong>{queueDepth.toString().padStart(2, "0")}</strong>
        </article>
        <article>
          <span className="meta-label">Triggers set</span>
          <strong>{withTrigger.toString().padStart(2, "0")}</strong>
        </article>
      </div>

      <div className="monitor-log">
        <p className="meta-label">Lead row</p>
        <p>{signalSummary}</p>
      </div>

      <Link href="/marketwatch" className="secondary-button full-width">
        Open Workbench
        <ArrowRight className="h-4 w-4" />
      </Link>
    </aside>
  );
}
