"use client";

import Link from "next/link";
import { ArrowRight, Flame, ShieldCheck, Sparkles } from "lucide-react";
import { QuoteStatusBadge, QuoteStatusLegend } from "@/components/market/QuoteStatusBadge";
import ReadyTradesCard, { type ReadyTradeView } from "@/components/dashboard/ReadyTradesCard";
import SmartWatchlistCard from "@/components/dashboard/SmartWatchlistCard";
import TodaysPrioritiesCard, { type DashboardPriority } from "@/components/dashboard/TodaysPrioritiesCard";
import type { QuoteDataStatus, QuoteProvider } from "@/types/market";
import type { Metric, TradeMode } from "@/types/trade";

type ProfileView = {
  equity: number;
  mode: TradeMode;
};

type ActiveTradeView = {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  conviction: "MAX" | "HIGH" | "STD" | null;
  source: "thesis" | "marketwatch";
  setupTypes: string[];
  shares: number;
  entryPrice: number;
  stopLoss: number;
  currentPrice: number;
  quoteStatus: QuoteDataStatus | null;
  quoteProvider: QuoteProvider | null;
  livePnl: number;
  livePnlPct: number;
  riskPct: number;
  trancheDeadline: string | null;
  r2Target: number | null;
  marketPrice: number | null;
  thesis: string;
};

type WatchTradeView = {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  fScore: number;
  fTotal: number;
  tScore: number;
  tTotal: number;
};

type ClosedTradeView = {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  closedAt: string | null;
  conviction: "MAX" | "HIGH" | "STD" | null;
};

type WatchlistItemView = {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  mode: string;
  verdict: string | null;
  note: string | null;
  source: string | null;
  lastScoredAt: string | null;
};

type DashboardClientProps = {
  profile: ProfileView;
  activeStrategy: {
    name: string;
    description: string;
    versionNumber: number;
    metrics: Metric[];
  };
  activeTrades: ActiveTradeView[];
  watchlistTrades: WatchTradeView[];
  closedTrades: ClosedTradeView[];
  customWatchlist: WatchlistItemView[];
  readyTrades: ReadyTradeView[];
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function DirectionBadge({ direction }: { direction: "LONG" | "SHORT" }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${direction === "LONG" ? "bg-tds-green/10 text-tds-green" : "bg-tds-red/10 text-tds-red"}`}>
      {direction}
    </span>
  );
}

export default function DashboardClient({ profile, activeStrategy, activeTrades, watchlistTrades, closedTrades, customWatchlist, readyTrades }: DashboardClientProps) {
  const heat = activeTrades.reduce((sum, trade) => sum + trade.riskPct * 100, 0);
  const livePnl = activeTrades.reduce((sum, trade) => sum + trade.livePnl, 0);
  const deployedCapital = activeTrades.reduce((sum, trade) => sum + (trade.entryPrice * trade.shares), 0);
  const livePnlPct = deployedCapital > 0 ? (livePnl / deployedCapital) * 100 : 0;
  const readyTradeCount = readyTrades.filter((item) => item.verdict === "GO").length;
  const queuedTradeCount = readyTrades.filter((item) => item.verdict === "CAUTION").length;

  const priorities: DashboardPriority[] = [];
  if (heat >= 10) {
    priorities.push({
      id: "rebalance-alert",
      title: "Rebalancing alert",
      detail: `Portfolio heat is ${heat.toFixed(2)}%. Compress exposure before adding new size.`,
      tone: "alert",
    });
  }

  for (const trade of activeTrades) {
    if (trade.r2Target != null) {
      const targetReached = trade.direction === "LONG" ? trade.currentPrice >= trade.r2Target : trade.currentPrice <= trade.r2Target;
      if (targetReached) {
        priorities.push({
          id: `target-${trade.id}`,
          title: `Target reached: ${trade.ticker}`,
          detail: `${trade.ticker} is trading through its 2R objective. Review partials, stop movement, and follow-through.`,
          tone: "success",
        });
      }
    }

    if (trade.trancheDeadline) {
      const daysUntilDeadline = Math.ceil((new Date(trade.trancheDeadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      if (daysUntilDeadline <= 2) {
        priorities.push({
          id: `deadline-${trade.id}`,
          title: `Tranche deadline: ${trade.ticker}`,
          detail: `${trade.ticker} tranche timing expires in ${Math.max(daysUntilDeadline, 0)} day(s). Confirm the add or reset the plan.`,
          tone: "warning",
        });
      }
    }
  }

  if (readyTradeCount > 0 || queuedTradeCount > 0) {
    priorities.unshift({
      id: "ready-trades",
      title: readyTradeCount > 0 ? `${readyTradeCount} ready trade${readyTradeCount === 1 ? "" : "s"} staged` : `${queuedTradeCount} scored trade${queuedTradeCount === 1 ? " is" : "s are"} close`,
      detail:
        readyTradeCount > 0
          ? `${readyTradeCount} workbench name${readyTradeCount === 1 ? " is" : "s are"} at GO. Review the AI Ready Board.`
          : `${queuedTradeCount} workbench name${queuedTradeCount === 1 ? " is" : "s are"} near GO. Keep them on deck.`,
      tone: readyTradeCount > 0 ? "success" : "info",
    });
  }

  const staleWatchlistCount = customWatchlist.filter((item) => !item.lastScoredAt || (Date.now() - new Date(item.lastScoredAt).getTime()) > 7 * 24 * 60 * 60 * 1000).length;
  if (staleWatchlistCount > 0) {
    priorities.push({
      id: "watchlist-refresh",
      title: "Watchlist refresh",
      detail: `${staleWatchlistCount} custom watchlist name${staleWatchlistCount === 1 ? " needs" : "s need"} re-scoring against the active strategy stack.`,
      tone: "info",
    });
  }

  if (priorities.length === 0) {
    priorities.push({
      id: "clear-lane",
      title: "No urgent workflow debt",
      detail: "Risk is controlled. Wait for high-quality entries.",
      tone: "info",
    });
  }

  return (
    <main className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_340px]">
        <div className="space-y-6">
          <div className="fin-hero px-6 py-6 sm:px-7 sm:py-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="fin-chip fin-chip-strong">Portfolio Health</p>
                <h1 className="mt-4 max-w-2xl text-2xl font-semibold tracking-[-0.05em] text-white sm:text-[2.1rem]">Live portfolio snapshot</h1>
              </div>
              <span className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${heat >= 10 ? "bg-tds-amber/20 text-amber-100" : "bg-tds-green/20 text-emerald-100"}`}>
                {heat >= 10 ? "Rebalance needed" : "Within limit"}
              </span>
            </div>

            <div className="mt-5 rounded-[22px] border border-white/12 bg-white/7 px-4 py-3 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-white/56">Active Capital</p>
              <p className="mt-2 text-sm font-semibold text-white">{money(deployedCapital)} deployed across {activeTrades.length} current trade{activeTrades.length === 1 ? "" : "s"}</p>
              <QuoteStatusLegend tone="dark" className="mt-4" />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[22px] border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Current P&amp;L</p>
                <p className="mt-2 font-mono text-2xl text-white">{livePnl >= 0 ? "+" : "-"}{money(Math.abs(livePnl))}</p>
                <p className="mt-2 text-xs text-white/68">{livePnlPct >= 0 ? "+" : ""}{livePnlPct.toFixed(2)}% on deployed capital</p>
              </div>
              <div className="rounded-[22px] border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Deployed</p>
                <p className="mt-2 font-mono text-2xl text-white">{money(deployedCapital)}</p>
                <p className="mt-2 text-xs text-white/68">Book size {money(profile.equity)}</p>
              </div>
              <div className="rounded-[22px] border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Heat</p>
                <p className="mt-2 font-mono text-2xl text-white">{heat.toFixed(1)}%</p>
                <p className="mt-2 text-xs text-white/68">Confirmed portfolio exposure</p>
              </div>
              <div className="rounded-[22px] border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Current Trades</p>
                <p className="mt-2 font-mono text-2xl text-white">{activeTrades.length.toString().padStart(2, "0")}</p>
                <p className="mt-2 text-xs text-white/68">Actively managed positions</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/trade/new" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-tds-slate shadow-[0_20px_44px_-28px_rgba(15,23,42,0.45)] hover:-translate-y-0.5">
                New thesis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/portfolio-analytics" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/16">
                Portfolio analytics
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <SmartWatchlistCard mode={profile.mode} strategyLabel={activeStrategy.name} metrics={activeStrategy.metrics} />
        </div>

        <div className="space-y-6">
          <ReadyTradesCard items={readyTrades} />

          <TodaysPrioritiesCard items={priorities.slice(0, 5)} />

          <section className="fin-panel p-6">
            <p className="fin-kicker">Review Queue</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">What needs attention next</h2>

            <div className="mt-5 space-y-3">
              <div className="fin-card flex items-start gap-3 p-4">
                <Flame className="mt-0.5 h-5 w-5 text-tds-amber" />
                <div>
                  <p className="fin-kicker">Heat Limit</p>
                  <p className="mt-1 text-sm text-tds-text">{heat.toFixed(2)}% current heat against a 12% operating max.</p>
                </div>
              </div>
              <div className="fin-card flex items-start gap-3 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-tds-green" />
                <div>
                  <p className="fin-kicker">Watch Queue</p>
                  <p className="mt-1 text-sm text-tds-text">{watchlistTrades.length} staged trade{watchlistTrades.length === 1 ? " is" : "s are"} waiting on confirmation.</p>
                </div>
              </div>
              <div className="fin-card flex items-start gap-3 p-4">
                <Sparkles className="mt-0.5 h-5 w-5 text-tds-blue" />
                <div>
                  <p className="fin-kicker">Closed Review</p>
                  <p className="mt-1 text-sm text-tds-text">{closedTrades.length} recent close{closedTrades.length === 1 ? " is" : "s are"} ready for analytics review.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="fin-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="fin-kicker">Active Positions</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Capital currently at work</h2>
            </div>
            <span className="fin-chip">{activeTrades.length} open</span>
          </div>

          {activeTrades.length === 0 ? (
            <div className="fin-card mt-6 flex flex-col items-start gap-4 p-6">
              <Sparkles className="h-5 w-5 text-tds-teal" />
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-tds-text">No active positions yet.</p>
                <p className="mt-2 text-sm leading-6 text-tds-dim">Start from MarketWatch or create a thesis-driven trade when a setup qualifies.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/trade/new" className="inline-flex h-11 items-center rounded-2xl bg-tds-slate px-4 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(13,21,40,0.68)] hover:-translate-y-0.5 hover:bg-[#162649]">
                  Start new thesis
                </Link>
                <Link href="/marketwatch" className="inline-flex h-11 items-center rounded-2xl border border-white/80 bg-white px-4 text-sm font-semibold text-tds-text shadow-sm hover:bg-tds-wash">
                  Scan MarketWatch
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {activeTrades.map((trade) => (
                <Link key={trade.id} href={`/trade/${trade.id}`} className="fin-card flex flex-wrap items-center justify-between gap-4 p-5 hover:-translate-y-0.5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-lg font-semibold text-tds-text">{trade.ticker}</span>
                      <DirectionBadge direction={trade.direction} />
                      {trade.conviction ? <span className="fin-chip">{trade.conviction}</span> : null}
                      {trade.source === "marketwatch" ? <span className="fin-chip">MarketWatch</span> : null}
                      <QuoteStatusBadge status={trade.quoteStatus ?? null} provider={trade.quoteProvider ?? null} />
                    </div>
                    <p className="text-sm text-tds-dim">Entry {trade.entryPrice.toFixed(2)} · Last {trade.currentPrice.toFixed(2)} · Risk {(trade.riskPct * 100).toFixed(2)}%</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-sm font-semibold ${trade.livePnl >= 0 ? "text-tds-green" : "text-tds-red"}`}>{trade.livePnl >= 0 ? "+" : "-"}{money(Math.abs(trade.livePnl))}</p>
                    <p className="mt-1 text-xs text-tds-dim">{trade.livePnlPct >= 0 ? "+" : ""}{trade.livePnlPct.toFixed(2)}%</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section className="fin-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="fin-kicker">Watchlist</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-tds-text">Pending confirmation</h2>
              </div>
              <span className="fin-chip">{watchlistTrades.length}</span>
            </div>

            <div className="mt-5 space-y-3">
              {watchlistTrades.length === 0 ? <p className="text-sm leading-6 text-tds-dim">No watchlist trades are waiting on technical confirmation.</p> : null}
              {watchlistTrades.map((trade) => (
                <Link key={trade.id} href={`/trade/${trade.id}`} className="fin-card flex items-center justify-between gap-3 p-4 hover:-translate-y-0.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-semibold text-tds-text">{trade.ticker}</span>
                      <DirectionBadge direction={trade.direction} />
                    </div>
                    <p className="mt-2 text-sm text-tds-dim">F {trade.fScore}/{trade.fTotal} · T {trade.tScore}/{trade.tTotal}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-tds-dim" />
                </Link>
              ))}
            </div>
          </section>

          <section className="fin-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="fin-kicker">Recent Closed</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-tds-text">Fresh review material</h2>
              </div>
              <span className="fin-chip">{closedTrades.length}</span>
            </div>

            <div className="mt-5 space-y-3">
              {closedTrades.length === 0 ? <p className="text-sm leading-6 text-tds-dim">No closed trades yet. Reviews will appear here after exits are complete.</p> : null}
              {closedTrades.map((trade) => (
                <Link key={trade.id} href={`/trade/${trade.id}`} className="fin-card flex items-center justify-between gap-3 p-4 hover:-translate-y-0.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-semibold text-tds-text">{trade.ticker}</span>
                      <DirectionBadge direction={trade.direction} />
                      {trade.conviction ? <span className="fin-chip">{trade.conviction}</span> : null}
                    </div>
                    <p className="mt-2 text-sm text-tds-dim">Closed {trade.closedAt ? new Date(trade.closedAt).toLocaleDateString() : "-"}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-tds-dim" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}