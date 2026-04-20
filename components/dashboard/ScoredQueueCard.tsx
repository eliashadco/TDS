"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Check, X, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReadyTradeView } from "@/components/dashboard/ReadyTradesCard";

type QueueAction = "accept" | "reject" | "snooze";

type ScoredQueueCardProps = {
  items: ReadyTradeView[];
};

function formatTrigger(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "Pending";
  return value.toFixed(2);
}

export default function ScoredQueueCard({ items }: ScoredQueueCardProps) {
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

        // For snooze, item stays in watchlist — just skip in the queue
        // For accept, navigate happens via the Link below
        // For reject, we already archived above

        // Reset index if we'd go out of bounds
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

  // Queue exhausted
  if (!current) {
    return (
      <aside className="surface-panel scored-queue-panel">
        <div className="surface-header scored-queue-header">
          <div>
            <p className="meta-label">Scored Queue</p>
            <h3>Assembly Line</h3>
          </div>
          <span className="signal-badge" aria-hidden="true">⚡</span>
        </div>

        <div className="scored-queue-empty">
          {lastAction ? (
            <p>
              Queue cleared. Last action: <strong>{lastAction.action}</strong> on{" "}
              <span className="font-mono">{lastAction.ticker}</span>.
            </p>
          ) : (
            <p>No scored setups ready. Scan the workbench for new ideas.</p>
          )}
          <Link href="/marketwatch" className="secondary-button full-width" style={{ marginTop: "0.75rem" }}>
            Open Workbench
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </aside>
    );
  }

  const fitPct = Math.round(current.passRate * 100);
  const verdictColor = current.verdict === "GO" ? "green" : "amber";

  return (
    <aside className="surface-panel scored-queue-panel">
      <div className="surface-header scored-queue-header">
        <div>
          <p className="meta-label">Scored Queue</p>
          <h3>Assembly Line</h3>
        </div>
        <span className="scored-queue-counter">
          {queueIndex + 1} / {total}
        </span>
      </div>

      {/* Current card */}
      <div className="scored-queue-card" data-verdict={verdictColor}>
        <div className="scored-queue-card-top">
          <div className="scored-queue-ticker">
            <span className="scored-queue-ticker-symbol">{current.ticker}</span>
            <span className={`inline-tag ${current.direction === "LONG" ? "green" : "red"}`}>
              {current.direction}
            </span>
            <span className={`inline-tag ${verdictColor}`}>{current.verdict}</span>
          </div>
          <div className="scored-queue-score">
            <span className="scored-queue-score-value">{fitPct}%</span>
            <span className="scored-queue-score-label">fit</span>
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
          {current.thesisSummary && (
            <p className="scored-queue-thesis">{current.thesisSummary}</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="scored-queue-actions">
        <button
          className="scored-queue-btn scored-queue-reject"
          onClick={() => void handleAction("reject")}
          disabled={actionPending}
          title="Reject — archive this setup"
        >
          <X className="h-5 w-5" />
          <span>Reject</span>
        </button>

        <button
          className="scored-queue-btn scored-queue-snooze"
          onClick={() => void handleAction("snooze")}
          disabled={actionPending}
          title="Snooze — keep on watchlist, review later"
        >
          <Clock className="h-5 w-5" />
          <span>Snooze</span>
        </button>

        <Link
          href={`/trade/new?ticker=${encodeURIComponent(current.ticker)}&direction=${current.direction}`}
          className="scored-queue-btn scored-queue-accept"
          title="Accept — open trade wizard for this setup"
        >
          <Check className="h-5 w-5" />
          <span>Accept</span>
        </Link>
      </div>

      {/* Nav arrows for browsing (but primary flow is act-on-top) */}
      {total > 1 && (
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
              <span
                key={item.id}
                className={`scored-queue-dot ${idx === queueIndex ? "active" : ""}`}
              />
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
      )}
    </aside>
  );
}
