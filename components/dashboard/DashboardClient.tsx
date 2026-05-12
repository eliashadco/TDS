"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";
import type { DashboardSummary } from "@/types/dashboard-summary";
import type { ReadyTradeView } from "@/components/dashboard/ReadyTradesCard";
import BlindEvaluationCard from "@/components/dashboard/BlindEvaluationCard";
import RiskMetricCard from "@/components/dashboard/RiskMetricCard";
import ExecutionQueueCard from "@/components/dashboard/ExecutionQueueCard";
import TodaysPrioritiesCard, { type DashboardPriority } from "@/components/dashboard/TodaysPrioritiesCard";
import { cn } from "@/lib/utils";
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

type DashboardClientProps = {
  summary: DashboardSummary;
  profile: ProfileView;
  activeStrategy: {
    id: string;
    name: string;
    description: string;
    versionNumber: number;
    metrics: Metric[];
  } | null;
  activeTrades: ActiveTradeView[];
  readyTrades: ReadyTradeView[];
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatModeLabel(mode: TradeMode | null): string {
  if (!mode) {
    return "Not set";
  }

  return mode === "daytrade" ? "Day Trade" : `${mode.charAt(0).toUpperCase()}${mode.slice(1)}`;
}

function DirectionBadge({ direction }: { direction: "LONG" | "SHORT" }) {
  return <span className={`inline-tag ${direction === "LONG" ? "green" : "red"}`}>{direction === "LONG" ? "Long" : "Short"}</span>;
}

export default function DashboardClient({
  summary,
  profile,
  activeStrategy,
  activeTrades,
  readyTrades,
}: DashboardClientProps) {
  const [discipline, setDiscipline] = useState<{
    score: number;
    summary: { totalTrades: number; inPolicyCount: number; overrideCount: number; oobCount: number; pnlInPolicy: number; pnlOverride: number };
  } | null>(null);

  useEffect(() => {
    fetch("/api/discipline")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setDiscipline(d); })
      .catch(() => {});
  }, []);

  const heat = summary.riskState.portfolioHeatPct;
  const livePnl = activeTrades.reduce((sum, trade) => sum + trade.livePnl, 0);
  const deployedCapital = activeTrades.reduce((sum, trade) => sum + trade.entryPrice * trade.shares, 0);
  const livePnlPct = deployedCapital > 0 ? (livePnl / deployedCapital) * 100 : 0;
  const displayEquity = Math.max(profile.equity, 0);
  const isHeatHot = heat > 6;
  const heatStateLabel = heat >= summary.riskState.cap ? "Heat Elevated" : heat > 6 ? "Heat Active" : "Heat Controlled";
  const liveDeltaLabel = `${livePnl >= 0 ? "+" : "-"}${money(Math.abs(livePnl))}`;

  const priorities: DashboardPriority[] = useMemo(() => {
    const out: DashboardPriority[] = [];

    if (heat >= summary.riskState.cap * 0.83) {
      out.push({
        id: "rebalance-alert",
        title: "Rebalancing alert",
        detail: `Portfolio heat is ${heat.toFixed(2)}% (cap ${summary.riskState.cap}%). Compress exposure before adding new size.`,
        tone: "alert",
      });
    }

    if (summary.circuitBreaker.active) {
      out.push({
        id: "circuit-breaker",
        title: "Circuit breaker active",
        detail: summary.circuitBreaker.reason ?? "Risk thresholds breached.",
        tone: "alert",
      });
    }

    for (const task of summary.actNow.slice(0, 12)) {
      const tone: DashboardPriority["tone"] =
        task.type === "review_due" || task.type === "blocker_clear" ? "warning" : "info";
      out.push({
        id: task.taskId,
        title: task.type.replace(/_/g, " "),
        detail: `${task.reason} · due ${new Date(task.dueAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
        tone,
      });
    }

    if (out.length === 0) {
      out.push({
        id: "clear-lane",
        title: "No urgent workflow debt",
        detail: "Risk is controlled. Wait for high-quality entries.",
        tone: "info",
      });
    }

    return out.slice(0, 8);
  }, [summary.actNow, summary.circuitBreaker.active, summary.circuitBreaker.reason, summary.riskState.cap, heat]);

  return (
    <main className="dashboard-terminal trade-terminal dashboard-cockpit">
      <section className="surface-panel dashboard-cockpit-hero">
        <div className="dashboard-hero-grid">
          <div className="dashboard-hero-copy">
            <p className="dashboard-hero-eyebrow">Portfolio Overview</p>
            <div className="dashboard-hero-equity-row">
              <h1 className="dashboard-equity-value">{money(displayEquity)}</h1>
              <div className={cn("dashboard-equity-delta", livePnl >= 0 ? "positive" : "negative")}>
                <span>{liveDeltaLabel}</span>
                <span>{livePnlPct >= 0 ? "+" : ""}{livePnlPct.toFixed(2)}%</span>
              </div>
            </div>
            <p className="dashboard-hero-copy-text">
              Live equity, portfolio heat, and execution readiness in one command surface designed to keep risk state and next action visible.
            </p>
            {summary.recentDecisions.length > 0 ? (
            <div className="mt-4 rounded-lg border border-slate-700/40 bg-slate-950/25 p-3">
              <p className="meta-label mb-2">Recent workflow decisions</p>
              <ul className="space-y-1.5 text-xs leading-relaxed text-tds-dim">
                {summary.recentDecisions.slice(0, 5).map((d) => (
                  <li key={`${d.at}-${d.eventType}-${d.summary.slice(0, 24)}`}>
                    <span className="text-tds-text/90">{new Date(d.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    {" · "}
                    {d.summary}
                  </li>
                ))}
              </ul>
            </div>
            ) : null}
          </div>

          <div className="dashboard-command-cluster">
            <div className="dashboard-primary-actions">
              <Link href="/trade/new" className="primary-button">
                Execute New Thesis
              </Link>
              <Link href="/portfolio-analytics" className="secondary-button">
                Open Analytics
              </Link>
            </div>
            <div className="dashboard-command-microgrid">
              <article className="dashboard-command-stat">
                <p className="meta-label">Mode</p>
                <strong>{formatModeLabel(profile.mode)}</strong>
              </article>
              <article className="dashboard-command-stat">
                <p className="meta-label">Active Strategy</p>
                <strong>{activeStrategy?.name ?? "No strategy"}</strong>
              </article>
              <article className="dashboard-command-stat">
                <p className="meta-label">Drafts · ready</p>
                <strong>{summary.pipelineCounts.ready}</strong>
              </article>
              <article className="dashboard-command-stat">
                <p className="meta-label">Pipeline · live</p>
                <strong>{summary.pipelineCounts.live}</strong>
              </article>
              <article className="dashboard-command-stat">
                <p className="meta-label">Reviews due</p>
                <strong>{summary.pipelineCounts.reviewDue}</strong>
              </article>
              <article className="dashboard-command-stat">
                <p className="meta-label">Heat cap</p>
                <strong>{summary.riskState.cap}%</strong>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-kpi-layer">
        <section className="surface-panel dashboard-kpi-shell">
          <div className="dashboard-section-head">
            <div>
              <p className="meta-label">Capital Stack</p>
              <h2>Deployment, live move, and risk heat</h2>
            </div>
            <span className={cn("meta-pill dashboard-risk-pill", isHeatHot ? "is-hot" : "is-safe")}>
              {heatStateLabel}
            </span>
          </div>

          <RiskMetricCard
            heat={heat}
            totalDeployed={deployedCapital}
            unrealizedPnL={livePnl}
            pnlPercent={livePnlPct}
            equity={profile.equity}
            activeTradeCount={summary.riskState.openTrades}
            heatStateLabel={heatStateLabel}
          />
        </section>

        <ExecutionQueueCard items={readyTrades} />
      </section>

      <section className="dashboard-monitoring-row">
        <BlindEvaluationCard activeStrategy={activeStrategy} items={readyTrades} />

        <div className="dashboard-monitoring-stack">
          {summary.circuitBreaker.active ? (
            <section className="surface-panel dashboard-circuit-shell" role="alert">
              <div className="dashboard-section-head dashboard-section-head-tight">
                <div>
                  <p className="meta-label">Risk Alert</p>
                  <h2>Circuit breaker active</h2>
                </div>
                <span className="dashboard-circuit-badge">Review</span>
              </div>
              <p className="dashboard-circuit-copy">{summary.circuitBreaker.reason}</p>
              {summary.circuitBreaker.restingUntil ? (
                <p className="mt-2 text-xs text-tds-dim">
                  Resting until {new Date(summary.circuitBreaker.restingUntil).toLocaleString("en-US")}
                </p>
              ) : null}
              <Link href="/trade/new" className="secondary-button dashboard-circuit-action">
                Review trade entry rules
              </Link>
            </section>
          ) : null}

          {discipline ? (
            <section className="surface-panel discipline-summary-card dashboard-discipline-shell">
              <div className="dashboard-section-head dashboard-section-head-tight">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-tds-teal" />
                  <div>
                    <p className="meta-label">Discipline</p>
                    <h2>Execution quality this week</h2>
                  </div>
                </div>
                <span
                  className="discipline-badge"
                  data-level={discipline.score >= 80 ? "high" : discipline.score >= 50 ? "mid" : "low"}
                >
                  <span className="discipline-badge-score">{discipline.score}</span>
                </span>
              </div>
              <div className="terminal-metric-grid terminal-metric-grid-spaced dashboard-discipline-grid">
                <article className="metric-card terminal-metric-card dashboard-kpi-panel">
                  <p className="meta-label">Total Trades</p>
                  <strong>{discipline.summary.totalTrades}</strong>
                </article>
                <article className="metric-card terminal-metric-card dashboard-kpi-panel">
                  <p className="meta-label">In Policy</p>
                  <strong className="positive">{discipline.summary.inPolicyCount}</strong>
                  {discipline.summary.pnlInPolicy !== 0 ? (
                    <span className={discipline.summary.pnlInPolicy >= 0 ? "positive" : "negative"}>
                      {discipline.summary.pnlInPolicy >= 0 ? "+" : ""}{discipline.summary.pnlInPolicy.toFixed(1)}%
                    </span>
                  ) : null}
                </article>
                <article className="metric-card terminal-metric-card dashboard-kpi-panel">
                  <p className="meta-label">Overrides</p>
                  <strong className={discipline.summary.overrideCount > 0 ? "text-tds-amber" : ""}>{discipline.summary.overrideCount}</strong>
                  {discipline.summary.pnlOverride !== 0 ? (
                    <span className={discipline.summary.pnlOverride >= 0 ? "positive" : "negative"}>
                      {discipline.summary.pnlOverride >= 0 ? "+" : ""}{discipline.summary.pnlOverride.toFixed(1)}%
                    </span>
                  ) : null}
                </article>
              </div>
            </section>
          ) : null}
        </div>
      </section>

      <section className="terminal-lower-grid dashboard-lower-grid">
        <section className="surface-panel positions-terminal-panel dashboard-positions-shell">
          <div className="dashboard-section-head">
            <div>
              <p className="meta-label">Execution Queue</p>
              <h2>Capital currently at work</h2>
            </div>
            <span className="tag">{summary.riskState.openTrades} Open Position{summary.riskState.openTrades === 1 ? "" : "s"}</span>
          </div>

          {activeTrades.length === 0 ? (
            <div className="dashboard-empty-shell">
              <div className="flex max-w-lg flex-col items-center gap-4 text-center">
                <Sparkles className="h-5 w-5 text-tds-teal" />
                <p>No active positions yet.</p>
                <span className="text-sm leading-6 text-tds-dim">Start from MarketWatch or open a new thesis when a setup qualifies.</span>
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
            <div className="dashboard-positions-stack">
              {activeTrades.map((trade) => (
                <Link key={trade.id} href={`/trade/${trade.id}`} className="dashboard-position-card transition-transform hover:-translate-y-0.5">
                  <div className="dashboard-position-main">
                    <div className={cn("dashboard-position-avatar", trade.direction === "LONG" ? "is-long" : "is-short")}>
                      {trade.ticker[0]}
                    </div>
                    <div className="dashboard-position-copy">
                      <div className="dashboard-position-topline">
                        <strong>{trade.ticker}</strong>
                        <DirectionBadge direction={trade.direction} />
                        {trade.conviction ? <span className="inline-tag neutral">{trade.conviction}</span> : null}
                        {trade.source === "marketwatch" ? <span className="inline-tag neutral">MarketWatch</span> : <span className="inline-tag neutral">Thesis</span>}
                      </div>
                      <p className="dashboard-position-thesis">{trade.thesis ? `${trade.thesis.slice(0, 76)}${trade.thesis.length > 76 ? "..." : ""}` : "No thesis summary recorded."}</p>
                      <p className="dashboard-position-meta">
                        Entry {trade.entryPrice.toFixed(2)} · Last {trade.currentPrice.toFixed(2)} · Risk {(trade.riskPct * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  <div className="dashboard-position-side">
                    <div className={cn("dashboard-position-pnl", trade.livePnl >= 0 ? "positive" : "negative")}>
                      {trade.livePnl >= 0 ? "+" : "-"}{money(Math.abs(trade.livePnl))}
                    </div>
                    <span className="dashboard-position-manage">Manage</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <TodaysPrioritiesCard items={priorities} />
      </section>
    </main>
  );
}