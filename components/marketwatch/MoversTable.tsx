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
  refreshingFeed: boolean;
  feedQualityLabel: string;
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

function getBarWidth(changePct: number): number {
  return Math.max(10, Math.min(Math.abs(changePct) * 8, 100));
}

const BAR_WIDTH_CLASSES = [
  "w-[10%]",
  "w-[20%]",
  "w-[30%]",
  "w-[40%]",
  "w-[50%]",
  "w-[60%]",
  "w-[70%]",
  "w-[80%]",
  "w-[90%]",
  "w-full",
] as const;

function getBarWidthClass(changePct: number): (typeof BAR_WIDTH_CLASSES)[number] {
  const width = getBarWidth(changePct);
  return BAR_WIDTH_CLASSES[Math.min(BAR_WIDTH_CLASSES.length - 1, Math.max(0, Math.ceil(width / 10) - 1))];
}

export default function MoversTable({
  movers,
  asOf,
  loadingTicker,
  watchingTicker,
  refreshingFeed,
  feedQualityLabel,
  onRefresh,
  onPreview,
  onWatch,
}: MoversTableProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/75 bg-white/88 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.24)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-semibold tracking-[-0.04em] text-tds-text">Most Active</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-tds-dim">{feedQualityLabel}</span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-tds-dim">{formatUpdatedDate(asOf)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Open a preview before scoring so the strategy, trigger, and quote context are clear.</p>
          <Button type="button" variant="secondary" size="sm" onClick={onRefresh} disabled={refreshingFeed}>
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshingFeed ? "animate-spin" : "")} />
            {refreshingFeed ? "Refreshing..." : "Refresh Movers"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/92 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-tds-dim">
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Company Name</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Volume</th>
              <th className="px-4 py-3 text-right">Chg</th>
              <th className="px-4 py-3 text-right">Chg %</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {movers.map((mover, index) => {
              const isPositive = mover.changePct >= 0;
              const hasQuoteData = hasLiveQuoteData(mover);
              const loading = loadingTicker === mover.ticker;
              const watching = watchingTicker === mover.ticker;
              const busy = loading || watching;

              return (
                <tr
                  key={mover.ticker}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", mover.ticker);
                    event.dataTransfer.setData("application/x-tds-mover", JSON.stringify(mover));
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  className={cn("border-t border-slate-200/70 align-top", index % 2 === 0 ? "bg-white" : "bg-slate-50/55")}
                >
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => onPreview(mover)}
                      className="font-mono text-base font-semibold text-tds-blue hover:text-sky-700"
                    >
                      {mover.ticker}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="max-w-[360px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-tds-text">{mover.name}</p>
                        {mover.sourceLabel ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-tds-dim">{mover.sourceLabel}</span> : null}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-tds-dim">{mover.reason}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-tds-text">{hasQuoteData ? formatCurrency(mover.price) : "Await live quote"}</td>
                  <td className="px-4 py-4 text-right font-mono text-tds-text">{hasQuoteData ? mover.volume : "Starter universe"}</td>
                  <td className={cn("px-4 py-4 text-right font-mono font-semibold", hasQuoteData ? (isPositive ? "text-tds-green" : "text-tds-red") : "text-tds-dim")}>
                    {hasQuoteData ? formatSignedCurrency(mover.change) : "--"}
                  </td>
                  <td className="px-4 py-4">
                    {hasQuoteData ? (
                      <div className="flex min-w-[180px] items-center justify-end gap-3">
                        <div className="h-4 w-24 overflow-hidden rounded-full bg-slate-200/80">
                          <div className={cn("h-full rounded-full", getBarWidthClass(mover.changePct), isPositive ? "bg-tds-green" : "bg-tds-red")} />
                        </div>
                        <span className={cn("min-w-[72px] text-right font-semibold", isPositive ? "text-tds-green" : "text-tds-red")}>
                          {isPositive ? "+" : ""}
                          {mover.changePct.toFixed(2)}%
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-tds-dim">
                          Open preview for fallback quote
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-[220px] justify-end gap-2">
                      <Button
                        type="button"
                        disabled={busy}
                        className="h-10 min-w-[88px] bg-tds-slate text-white hover:bg-[#162649]"
                        onClick={() => onPreview(mover)}
                      >
                        {loading ? "Scoring..." : "Preview"}
                      </Button>
                      <Button
                        type="button"
                        disabled={busy}
                        className="h-10 min-w-[88px] border-slate-200 bg-white text-tds-text hover:bg-slate-50"
                        onClick={() => onWatch(mover)}
                      >
                        {watching ? "Saving..." : "Watch"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}