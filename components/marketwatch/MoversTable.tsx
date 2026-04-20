"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Mover } from "@/types/market";

type MoversTableProps = {
  movers: Mover[];
  asOf?: number | null;
  loadingTicker: string | null;
  watchingTicker: string | null;
  watchEnabled?: boolean;
  watchDisabledLabel?: string;
  refreshingFeed: boolean;
  feedQualityLabel: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onPreview: (mover: Mover) => void;
  onWatch: (mover: Mover) => void;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedCurrency(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function formatCompactVolume(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function hasLiveQuoteData(mover: Mover): boolean {
  return mover.price > 0 || mover.volumeValue > 0 || Math.abs(mover.changePct) > 0 || Math.abs(mover.change) > 0;
}

function formatUpdatedDate(asOf?: number | null): string {
  if (!asOf) {
    return "Table synced to the latest feed.";
  }

  return `Table Updated: ${new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(asOf)}`;
}

export default function MoversTable({
  movers,
  asOf,
  loadingTicker,
  watchingTicker,
  watchEnabled = true,
  watchDisabledLabel = "Watch",
  refreshingFeed,
  feedQualityLabel,
  currentPage,
  totalPages,
  onPageChange,
  onRefresh,
  onPreview,
  onWatch,
}: MoversTableProps) {
  return (
    <div className="surface-panel terminal-table-shell movers-shell">
      <div className="movers-table-meta border-b border-slate-200/80 px-4 py-3">
        <span className="inline-tag neutral">{feedQualityLabel}</span>
        {asOf ? <span className="inline-tag neutral">{formatUpdatedDate(asOf)}</span> : null}
        <span className="inline-tag neutral movers-drag-hint">Drag rows ↘ to Watchlist or Workbench</span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshingFeed}
          aria-label="Refresh movers feed"
          className="movers-refresh-btn"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshingFeed ? "animate-spin" : "")} />
        </button>
      </div>
      <div className="terminal-table-header five-col-header">
        <span>Ticker</span>
        <span>Price</span>
        <span>Change</span>
        <span>Volume</span>
        <span>Action</span>
      </div>

      <div className="terminal-row-list">
        {movers.map((mover, index) => {
          const isPositive = mover.changePct >= 0;
          const hasQuoteData = hasLiveQuoteData(mover);
          const loading = loadingTicker === mover.ticker;
          const watching = watchingTicker === mover.ticker;
          const busy = loading || watching;

          return (
            <article
              key={mover.ticker}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", mover.ticker);
                event.dataTransfer.setData("application/x-tds-mover", JSON.stringify(mover));
                event.dataTransfer.effectAllowed = "copy";
              }}
              className={cn("terminal-table-row five-col-row", index % 2 === 0 ? "bg-white/70" : "bg-slate-50/60")}
            >
              <button
                type="button"
                onClick={() => onPreview(mover)}
                className="ticker-cell w-fit text-left font-mono text-sm font-semibold hover:text-sky-700"
              >
                {mover.ticker}
              </button>

              <span className="font-mono text-sm text-tds-text">{hasQuoteData ? formatCurrency(mover.price) : "Await live quote"}</span>

              <span className={cn("font-mono text-sm font-semibold", hasQuoteData ? (isPositive ? "positive" : "negative") : "text-tds-dim")}>
                {hasQuoteData ? `${formatSignedCurrency(mover.change)} (${isPositive ? "+" : ""}${mover.changePct.toFixed(2)}%)` : "--"}
              </span>

              <span className="font-mono text-sm text-tds-text">{hasQuoteData ? formatCompactVolume(mover.volumeValue) : mover.volume}</span>

              <div className="row-actions">
                <Button
                  type="button"
                  disabled={busy || !watchEnabled}
                  className="h-9 min-w-[86px] border-slate-200 bg-white text-tds-text hover:bg-slate-50"
                  onClick={() => onWatch(mover)}
                >
                  {watching ? "Saving..." : loading ? "Scoring..." : watchEnabled ? "Watch" : watchDisabledLabel}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {totalPages > 1 ? (
        <div className="marketwatch-pagination border-t border-slate-200/80 px-5 py-4">
          <Button type="button" size="sm" variant="secondary" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
            Previous
          </Button>
          <span className="tag">Page {currentPage} of {totalPages}</span>
          <Button type="button" size="sm" variant="secondary" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}