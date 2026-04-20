"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";
import type { ReadyTradeView } from "@/components/dashboard/ReadyTradesCard";
import BlindEvaluationCard from "@/components/dashboard/BlindEvaluationCard";
import ScoredQueueCard from "@/components/dashboard/ScoredQueueCard";
import TodaysPrioritiesCard, { type DashboardPriority } from "@/components/dashboard/TodaysPrioritiesCard";
import type { QuoteDataStatus, QuoteProvider } from "@/types/market";
import type { Metric, TradeMode } from "@/types/trade";

type ProfileView = {
  equity: number;
  mode: TradeMode | null;
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
    id: string;
    name: string;
    description: string;
    versionNumber: number;
    metrics: Metric[];
  } | null;
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
  return <span className={`inline-tag ${direction === "LONG" ? "green" : "red"}`}>{direction === "LONG" ? "Long" : "Short"}</span>;
}

export default function DashboardClient({ profile, activeStrategy, activeTrades, customWatchlist, readyTrades }: DashboardClientProps) {
  const [discipline, setDiscipline] = useState<{
    score: number;
    summary: { totalTrades: number; inPolicyCount: number; overrideCount: number; oobCount: number; pnlInPolicy: number; pnlOverride: number };
  } | null>(null);
  const [circuitBreaker, setCircuitBreaker] = useState<{ tripped: boolean; reason: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/discipline")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setDiscipline(d); })
      .catch(() => {});
    fetch("/api/circuit-breaker")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCircuitBreaker(d); })
      .catch(() => {});
  }, []);

  const heat = activeTrades.reduce((sum, trade) => sum + trade.riskPct * 100, 0);
  const livePnl = activeTrades.reduce((sum, trade) => sum + trade.livePnl, 0);
  const deployedCapital = activeTrades.reduce((sum, trade) => sum + trade.entryPrice * trade.shares, 0);
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

  const staleWatchlistCount = customWatchlist.filter((item) => !item.lastScoredAt || Date.now() - new Date(item.lastScoredAt).getTime() > 7 * 24 * 60 * 60 * 1000).length;
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
    <main className="dashboard-terminal">
      <section className="dashboard-action-row">
        <div className="terminal-page-header">
          <p className="meta-label">Dashboard</p>
          <h2>Decision surface</h2>
          <p className="page-intro">Portfolio state, signal readiness, and active work in a tighter operating layout.</p>
        </div>
        <div className="dashboard-primary-actions">
          <Link href="/trade/new" className="primary-button">
            Execute New Thesis
          </Link>
          <Link href="/portfolio-analytics" className="secondary-button">
            Full Analytics
          </Link>
        </div>
      </section>

      <section className="dashboard-terminal-grid">
        <section className="surface-panel overview-panel">
          <div className="surface-header overview-header">
            <div>
              <p className="meta-label">Portfolio Overview</p>
              <h3>Real-time execution picture</h3>
            </div>
            <span className={`meta-pill ${heat >= 10 ? "border-amber-200 bg-amber-50 text-amber-700" : "success-pill"}`}>
              {heat >= 10 ? "Risk: Elevated" : "Risk: Nominal"}
            </span>
          </div>

          <div className="terminal-metric-grid">
            <article className="metric-card terminal-metric-card">
              <p className="meta-label">Total Deployed</p>
              <strong>{money(deployedCapital)}</strong>
              <span>{((deployedCapital / Math.max(profile.equity, 1)) * 100).toFixed(1)}% of book is allocated</span>
            </article>
            <article className="metric-card terminal-metric-card">
              <p className="meta-label">Unrealized P&amp;L</p>
              <strong className={livePnl >= 0 ? "positive" : "negative"}>
                {livePnl >= 0 ? "+" : "-"}
                {money(Math.abs(livePnl))}
              </strong>
              <span>
                {livePnlPct >= 0 ? "+" : ""}
                {livePnlPct.toFixed(2)}% on deployed capital
              </span>
            </article>
            <article className="metric-card terminal-metric-card">
              <p className="meta-label">Portfolio Heat</p>
              <strong>{heat.toFixed(1)}%</strong>
              <span>Max allowed: 12% · Active trades: {activeTrades.length}</span>
            </article>
          </div>
        </section>

        <ScoredQueueCard items={readyTrades} />
      </section>

      <BlindEvaluationCard activeStrategy={activeStrategy} items={readyTrades} />

      {circuitBreaker?.tripped && (
        <div className="circuit-breaker-banner" role="alert">
          <span className="circuit-breaker-banner-icon">⚠</span>
          <div>
            <strong>Circuit Breaker Active</strong>
            <p>{circuitBreaker.reason}</p>
          </div>
          <Link href="/trade/new" className="circuit-breaker-banner-btn">
            Review
          </Link>
        </div>
      )}

      {discipline && (
        <section className="surface-panel discipline-summary-card">
          <div className="surface-header">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-tds-teal" />
              <div>
                <p className="meta-label">Discipline Report</p>
                <h3>Weekly summary</h3>
              </div>
            </div>
            <span
              className="discipline-badge"
              data-level={discipline.score >= 80 ? "high" : discipline.score >= 50 ? "mid" : "low"}
            >
              <span className="discipline-badge-score">{discipline.score}</span>
            </span>
          </div>
          <div className="terminal-metric-grid" style={{ marginTop: "12px" }}>
            <article className="metric-card terminal-metric-card">
              <p className="meta-label">Total Trades</p>
              <strong>{discipline.summary.totalTrades}</strong>
            </article>
            <article className="metric-card terminal-metric-card">
              <p className="meta-label">In Policy</p>
              <strong className="positive">{discipline.summary.inPolicyCount}</strong>
              {discipline.summary.pnlInPolicy !== 0 && (
                <span className={discipline.summary.pnlInPolicy >= 0 ? "positive" : "negative"}>
                  {discipline.summary.pnlInPolicy >= 0 ? "+" : ""}{discipline.summary.pnlInPolicy.toFixed(1)}%
                </span>
              )}
            </article>
            <article className="metric-card terminal-metric-card">
              <p className="meta-label">Overrides</p>
              <strong className={discipline.summary.overrideCount > 0 ? "text-tds-amber" : ""}>{discipline.summary.overrideCount}</strong>
              {discipline.summary.pnlOverride !== 0 && (
                <span className={discipline.summary.pnlOverride >= 0 ? "positive" : "negative"}>
                  {discipline.summary.pnlOverride >= 0 ? "+" : ""}{discipline.summary.pnlOverride.toFixed(1)}%
                </span>
              )}
            </article>
          </div>
        </section>
      )}

      <section className="terminal-lower-grid">
        <section className="surface-panel positions-terminal-panel">
          <div className="surface-header">
            <div>
              <p className="meta-label">Active Positions</p>
              <h3>Capital currently at work</h3>
            </div>
            <span className="tag">{activeTrades.length} Open Position{activeTrades.length === 1 ? "" : "s"}</span>
          </div>

          {activeTrades.length === 0 ? (
            <div className="empty-state-panel mt-4">
              <div className="flex max-w-lg flex-col items-center gap-4 text-center">
                <Sparkles className="h-5 w-5 text-tds-teal" />
                <p>No active positions yet.</p>
                <span className="text-sm leading-6 text-tds-dim">Start from MarketWatch or create a thesis-driven trade when a setup qualifies.</span>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link href="/trade/new" className="primary-button">
                    Start new thesis
                  </Link>
                  <Link href="/marketwatch" className="secondary-button">
                    Scan MarketWatch
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="position-list">
              {activeTrades.map((trade) => (
                <Link key={trade.id} href={`/trade/${trade.id}`} className="position-row transition-transform hover:-translate-y-0.5">
                  <div>
                    <div className="row-title">
                      <span>{trade.ticker}</span>
                      <DirectionBadge direction={trade.direction} />
                    </div>
                    <p className="mt-2 text-sm text-tds-dim">
                      Entry {trade.entryPrice.toFixed(2)} · Last {trade.currentPrice.toFixed(2)} · Risk {(trade.riskPct * 100).toFixed(2)}%
                      {trade.conviction ? ` · ${trade.conviction} conviction` : ""}
                      {trade.source === "marketwatch" ? " · MarketWatch" : ""}
                    </p>
                  </div>
                  <div className={`row-value ${trade.livePnl >= 0 ? "positive" : "negative"}`}>
                    {trade.livePnl >= 0 ? "+" : "-"}
                    {money(Math.abs(trade.livePnl))}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <TodaysPrioritiesCard items={priorities.slice(0, 5)} />
      </section>
    </main>
  );
}