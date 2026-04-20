"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DrawerTrade = {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  source?: "thesis" | "marketwatch";
  confirmed?: boolean;
  closed?: boolean;
  created_at?: string;
};

type TradeDrawerProps = {
  trades: DrawerTrade[];
  open: boolean;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSelectTrade: (tradeId: string) => void;
};

type FilterKey = "all" | "long" | "short" | "watch" | "closed";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "long", label: "▲ Long" },
  { key: "short", label: "▼ Short" },
  { key: "watch", label: "◉ Watch" },
  { key: "closed", label: "✕ Closed" },
];

function formatDate(value?: string): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export default function TradeDrawer({ trades, open, loading = false, error = null, onClose, onSelectTrade }: TradeDrawerProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      const tickerMatches = trade.ticker.toLowerCase().includes(search.toLowerCase());
      if (!tickerMatches) {
        return false;
      }

      if (filter === "long") {
        return trade.direction === "LONG";
      }
      if (filter === "short") {
        return trade.direction === "SHORT";
      }
      if (filter === "watch") {
        return !trade.confirmed && !trade.closed;
      }
      if (filter === "closed") {
        return Boolean(trade.closed);
      }

      return true;
    });
  }, [filter, search, trades]);

  return (
    <>
      <button
        aria-label="Close trade drawer backdrop"
        type="button"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed right-3 top-3 z-50 flex h-[calc(100vh-1.5rem)] w-[340px] flex-col surface-panel p-4 transition-transform duration-300 sm:w-[380px]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="meta-label">Trade Drawer</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Open positions and watchlist</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trade drawer"
            title="Close trade drawer"
            className="rounded-2xl border border-white/80 bg-white/82 p-2 text-tds-dim shadow-sm hover:bg-white hover:text-tds-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search ticker"
          className="mb-4"
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]",
                filter === item.key
                  ? "border-blue-200 bg-blue-50 text-tds-blue shadow-[0_16px_30px_-24px_rgba(37,99,235,0.5)]"
                  : "border-white/75 bg-white/78 text-tds-dim hover:bg-white",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="h-[calc(100vh-255px)] space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <div className="rounded-[24px] border border-dashed border-tds-border bg-white/72 p-5 text-center text-xs uppercase tracking-[0.16em] text-tds-dim">
              Loading trades...
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-[24px] border border-tds-red/20 bg-tds-red/10 p-5 text-center text-xs uppercase tracking-[0.16em] text-tds-red">
              {error}
            </div>
          ) : null}

          {!loading && !error ? filteredTrades.map((trade) => {
            const createdAt = trade.created_at;
            const isLong = trade.direction === "LONG";

            return (
              <button
                key={trade.id}
                type="button"
                onClick={() => {
                  onSelectTrade(trade.id);
                  onClose();
                }}
                className="w-full rounded-[20px] border border-slate-200/80 bg-white/78 px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-base font-semibold text-tds-text">{trade.ticker}</span>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", isLong ? "bg-tds-green/10 text-tds-green" : "bg-tds-red/10 text-tds-red")}>{isLong ? "Long" : "Short"}</span>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-tds-dim">
                  <div className="flex items-center gap-2">
                    {trade.source === "marketwatch" ? <span className="rounded-full bg-tds-pink/10 px-2 py-1 text-tds-pink">MarketWatch</span> : null}
                    {!trade.confirmed && !trade.closed ? <span className="rounded-full bg-tds-amber/10 px-2 py-1 text-tds-amber">Watch</span> : null}
                    {trade.closed ? <span className="rounded-full bg-slate-100 px-2 py-1 text-tds-text">Closed</span> : null}
                  </div>
                  <span>{formatDate(createdAt)}</span>
                </div>
              </button>
            );
          }) : null}

          {!loading && !error && filteredTrades.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-tds-border bg-white/72 p-5 text-center text-xs uppercase tracking-[0.16em] text-tds-dim">
              No trades match current filters.
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
