"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Check, X, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReadyTradeView } from "@/components/dashboard/ReadyTradesCard";

type QueueAction = "accept" | "reject" | "snooze";

type ExecutionQueueCardProps = {
  items: ReadyTradeView[];
};

function formatTrigger(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "Pending";
  return value.toFixed(2);
}

function formatUpdatedShort(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ExecutionQueueCard({ items }: ExecutionQueueCardProps) {
  const [queueIndex, setQueueIndex] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [actionPending, setActionPending] = useState(false);
  const [lastAction, setLastAction] = useState<{ ticker: string; action: QueueAction } | null>(null);

  const remaining = items.filter((item) => !dismissed.has(item.id));
  const current = remaining[queueIndex] ?? null;
  const total = remaining.length;

  const handleAction = useCallback(
    async (action: QueueAction) => {
      if (!current || actionPending) return;
      setActionPending(true);

      try {
        if (action === "reject") {
          const res = await fetch("/api/market/watchlist-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId: current.id, action: "archive" }),
          });
          if (!res.ok) throw new Error("Failed to archive");
        }

        setLastAction({ ticker: current.ticker, action });
        setDismissed((prev) => new Set(prev).add(current.id));

        if (queueIndex >= total - 1) {
          setQueueIndex(0);
        }
      } catch {
        // Silently handle — item stays in queue
      } finally {
        setActionPending(false);
      }
    },
    [current, actionPending, queueIndex, total],
  );

  if (!current) {
    return (
      <aside className="surface-panel scored-queue-panel">
        <div className="surface-header scored-queue-header">
          <div>
            <p className="meta-label">Execution Board</p>
            <h3>Workbench queue is clear</h3>
          </div>
          <span className="signal-badge" aria-hidden="true">
            ⚡
          </span>
        </div>

        <div className="scored-queue-empty">
          {lastAction ? (
            <p>
              Queue cleared. Last action: <strong>{lastAction.action}</strong> on{" "}
              <span className="font-mono">{lastAction.ticker}</span>.
            </p>
          ) : (
            <p>No MarketWatch workbench rows are queued here. Save a candidate from the workbench to populate this lane.</p>
          )}
          <Link href="/marketwatch" className="secondary-button full-width scored-queue-empty-action">
            Open Workbench
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </aside>
    );
  }

  return (
    <aside className="surface-panel scored-queue-panel">
      <div className="surface-header scored-queue-header">
        <div>
          <p className="meta-label">Execution Board</p>
          <h3>Next workbench candidate</h3>
        </div>
        <span className="scored-queue-counter">
          {queueIndex + 1} / {total}
        </span>
      </div>

      <div className="scored-queue-card" data-verdict="neutral">
        <div className="scored-queue-card-top">
          <div className="scored-queue-ticker">
            <span className="scored-queue-ticker-symbol">{current.ticker}</span>
            <span className={`inline-tag ${current.direction === "LONG" ? "green" : "red"}`}>{current.direction}</span>
            <span className="inline-tag neutral">Workbench</span>
          </div>
          <div className="scored-queue-score">
            <span className="scored-queue-score-value">{formatUpdatedShort(current.updatedAt)}</span>
            <span className="scored-queue-score-label">updated</span>
          </div>
        </div>

        <div className="scored-queue-details">
          <div className="scored-queue-detail-row">
            <span className="meta-label">Strategy</span>
            <span>{current.strategyLabel}</span>
          </div>
          <div className="scored-queue-detail-row">
            <span className="meta-label">Trigger</span>
            <span className="font-mono">{formatTrigger(current.triggerLevel)}</span>
          </div>
          {current.thesisSummary ? <p className="scored-queue-thesis">{current.thesisSummary}</p> : null}
        </div>
      </div>

      <div className="scored-queue-actions">
        <button
          className="scored-queue-btn scored-queue-reject"
          onClick={() => void handleAction("reject")}
          disabled={actionPending}
          title="Reject — archive this setup"
        >
          <X className="h-5 w-5" />
          <span>Archive</span>
        </button>

        <button
          className="scored-queue-btn scored-queue-snooze"
          onClick={() => void handleAction("snooze")}
          disabled={actionPending}
          title="Snooze — keep on watchlist, review later"
        >
          <Clock className="h-5 w-5" />
          <span>Defer</span>
        </button>

        <Link
          href={`/trade/new?ticker=${encodeURIComponent(current.ticker)}&direction=${current.direction}`}
          className="scored-queue-btn scored-queue-accept"
          title="Open trade wizard for this setup"
        >
          <Check className="h-5 w-5" />
          <span>Execute</span>
        </Link>
      </div>

      {total > 1 ? (
        <div className="scored-queue-nav">
          <button
            className="scored-queue-nav-btn"
            disabled={queueIndex <= 0}
            onClick={() => setQueueIndex((prev) => Math.max(0, prev - 1))}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="scored-queue-nav-dots">
            {remaining.map((item, idx) => (
              <span key={item.id} className={`scored-queue-dot ${idx === queueIndex ? "active" : ""}`} />
            ))}
          </span>
          <button
            className="scored-queue-nav-btn"
            disabled={queueIndex >= total - 1}
            onClick={() => setQueueIndex((prev) => Math.min(total - 1, prev + 1))}
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </aside>
  );
}
