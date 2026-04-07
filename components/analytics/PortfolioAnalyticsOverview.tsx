"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { QuoteStatusBadge, QuoteStatusLegend } from "@/components/market/QuoteStatusBadge";
import AnalyticsClient from "@/components/analytics/AnalyticsClient";
import { resolveMetricAssessmentDescription } from "@/lib/trading/user-metrics";
import type { QuoteDataStatus, QuoteProvider } from "@/types/market";
import type { Metric, Trade, TradeMode } from "@/types/trade";

type ActiveTradeAnalyticsView = {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  source: "thesis" | "marketwatch";
  conviction: "MAX" | "HIGH" | "STD" | null;
  setupTypes: string[];
  thesis: string;
  entryPrice: number;
  currentPrice: number;
  quoteStatus: QuoteDataStatus | null;
  quoteProvider: QuoteProvider | null;
  livePnl: number;
  livePnlPct: number;
  riskPct: number;
  strategyName: string;
  strategyDescription: string;
  strategyVersionNumber: number | null;
  strategyMetrics: Metric[];
  usesDefaultStrategyFallback: boolean;
};

type ActiveStrategyContextView = {
  name: string;
  description: string;
  versionNumber: number;
  metricCount: number;
};

type StrategyRefresh = {
  tradeId: string;
  score: number;
  passed: number;
  total: number;
  verdict: "GO" | "CAUTION" | "STOP";
  summary: string;
  edge?: string;
  risks?: string;
  fallback: boolean;
};

type PortfolioAnalyticsOverviewProps = {
  mode: TradeMode;
  activeStrategy: ActiveStrategyContextView;
  activeTrades: ActiveTradeAnalyticsView[];
  closedTrades: Trade[];
};

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatModeLabel(mode: TradeMode): string {
  if (mode === "daytrade") {
    return "Day Trade";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function fallbackVerdict(score: number): StrategyRefresh["verdict"] {
  if (score >= 80) {
    return "GO";
  }
  if (score >= 60) {
    return "CAUTION";
  }
  return "STOP";
}

function fallbackScore(trade: ActiveTradeAnalyticsView): number {
  const pnlBias = Math.min(20, Math.abs(trade.livePnlPct) * 3);
  const riskBias = Math.max(0, 20 - trade.riskPct * 100 * 1.5);
  const convictionBias = trade.conviction === "MAX" ? 18 : trade.conviction === "HIGH" ? 12 : 7;
  const directionalBias = trade.livePnl >= 0 ? 15 : 5;

  return Math.max(35, Math.min(92, Math.round(25 + pnlBias + riskBias + convictionBias + directionalBias)));
}

async function mapInBatches<T, TResult>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(worker))));
  }

  return results;
}

export default function PortfolioAnalyticsOverview({ mode, activeStrategy, activeTrades, closedTrades }: PortfolioAnalyticsOverviewProps) {
  const [refreshRows, setRefreshRows] = useState<Record<string, StrategyRefresh>>({});
  const [loading, setLoading] = useState(activeTrades.length > 0);

  useEffect(() => {
    let isActive = true;

    async function refreshStrategies() {
      if (activeTrades.length === 0) {
        setRefreshRows({});
        setLoading(false);
        return;
      }

      setLoading(true);

      const rows = await mapInBatches(activeTrades, 4, async (trade) => {
        const metrics = trade.strategyMetrics.filter((metric) => metric.enabled);

        if (metrics.length === 0) {
          return {
            tradeId: trade.id,
            score: 0,
            passed: 0,
            total: 0,
            verdict: "STOP",
            summary: `${trade.ticker} has no enabled checks saved in its assigned strategy, so the refresh could not be run.`,
            risks: "Reopen the strategy and restore at least one enabled check before relying on follow-up analytics.",
            fallback: true,
          } satisfies StrategyRefresh;
        }

          try {
            const assessResponse = await fetch("/api/ai/assess", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ticker: trade.ticker,
                direction: trade.direction,
                thesis: trade.thesis || `${trade.ticker} active trade follow-up review.`,
                setups: trade.setupTypes.length > 0 ? trade.setupTypes : [`${formatModeLabel(mode)} active strategy`],
                asset: "Equity",
                mode,
                metrics: metrics.map((metric) => ({
                  id: metric.id,
                  name: metric.name,
                  desc: resolveMetricAssessmentDescription(metric, trade.direction),
                })),
              }),
            });

            if (!assessResponse.ok) {
              throw new Error("Assessment unavailable");
            }

            const assessPayload = (await assessResponse.json()) as Record<string, { v: "PASS" | "FAIL"; r: string }>;
            const passedMetrics = metrics.filter((metric) => assessPayload[metric.id]?.v === "PASS").map((metric) => metric.name);
            const failedMetrics = metrics.filter((metric) => assessPayload[metric.id]?.v === "FAIL").map((metric) => metric.name);
            const passed = passedMetrics.length;
            const total = metrics.length;
            const score = total > 0 ? Math.round((passed / total) * 100) : 0;

            let verdict: StrategyRefresh["verdict"] = score >= 80 ? "GO" : score >= 60 ? "CAUTION" : "STOP";
            let summary = `${trade.ticker} refreshed against ${trade.strategyName}${trade.strategyVersionNumber ? ` v${trade.strategyVersionNumber}` : ""}.`;
            let edge: string | undefined;
            let risks: string | undefined;

            try {
              const insightResponse = await fetch("/api/ai/insight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ticker: trade.ticker,
                  direction: trade.direction,
                  passed: passedMetrics,
                  failed: failedMetrics,
                  thesis: trade.thesis || `${trade.ticker} active trade follow-up review.`,
                }),
              });

              if (insightResponse.ok) {
                const insight = (await insightResponse.json()) as { verdict: "GO" | "CAUTION" | "STOP"; summary: string; edge?: string; risks?: string };
                verdict = insight.verdict;
                summary = insight.summary;
                edge = insight.edge;
                risks = insight.risks;
              }
            } catch {
              // Fall back to the strategy score summary below.
            }

            return {
              tradeId: trade.id,
              score,
              passed,
              total,
              verdict,
              summary,
              edge,
              risks,
              fallback: false,
            } satisfies StrategyRefresh;
          } catch {
            const score = fallbackScore(trade);
            return {
              tradeId: trade.id,
              score,
              passed: 0,
              total: trade.strategyMetrics.length,
              verdict: fallbackVerdict(score),
              summary: `${trade.ticker} strategy refresh fell back to live performance, risk load, and conviction because AI follow-up for ${trade.strategyName} is unavailable right now.`,
              risks: trade.livePnl < 0 ? "Negative live P&L needs review before adding size." : "No AI risk summary available.",
              fallback: true,
            } satisfies StrategyRefresh;
          }
      });

      if (!isActive) {
        return;
      }

      setRefreshRows(
        rows.reduce<Record<string, StrategyRefresh>>((acc, row) => {
          acc[row.tradeId] = row;
          return acc;
        }, {}),
      );
      setLoading(false);
    }

    void refreshStrategies();

    return () => {
      isActive = false;
    };
  }, [activeTrades, mode]);

  const aggregatePnl = activeTrades.reduce((sum, trade) => sum + trade.livePnl, 0);
  const averageScore = average(Object.values(refreshRows).map((row) => row.score));
  const goCount = Object.values(refreshRows).filter((row) => row.verdict === "GO").length;
  const legacyFallbackCount = activeTrades.filter((trade) => trade.usesDefaultStrategyFallback).length;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_340px]">
        <div className="fin-panel p-6 sm:p-8">
          <p className="fin-kicker">Live Trade Performance</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-tds-text">Refresh each active trade against its assigned strategy before making the next decision.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-tds-dim">This view combines live performance with an updated strategy score and follow-up recommendation so current positions stay tied to the same saved strategy used at entry, not whatever the current mode stack happens to be today.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="fin-card p-5">
              <p className="fin-kicker">Open Trades</p>
              <p className="mt-3 font-mono text-3xl text-tds-text">{activeTrades.length}</p>
            </div>
            <div className="fin-card p-5">
              <p className="fin-kicker">Live P&amp;L</p>
              <p className={`mt-3 font-mono text-3xl ${aggregatePnl >= 0 ? "text-tds-green" : "text-tds-red"}`}>{aggregatePnl >= 0 ? "+" : "-"}{money(Math.abs(aggregatePnl))}</p>
            </div>
            <div className="fin-card p-5">
              <p className="fin-kicker">Avg Strategy Score</p>
              <p className="mt-3 font-mono text-3xl text-tds-text">{loading ? "--" : averageScore.toFixed(0)}</p>
              <p className="mt-2 text-sm text-tds-dim">{goCount} GO recommendation{goCount === 1 ? "" : "s"} across active trades.</p>
            </div>
          </div>
        </div>

        <aside className="fin-panel p-6">
          <p className="fin-kicker">Strategy Context</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Current scoring lane</h2>
          <div className="mt-5 space-y-3 text-sm leading-6 text-tds-dim">
            <p>Mode: {formatModeLabel(mode)}</p>
            <p>Default strategy: {activeStrategy.name} · v{activeStrategy.versionNumber}</p>
            <p>Default enabled checks: {activeStrategy.metricCount}</p>
            <p>Active-trade follow-up reads each trade&apos;s saved strategy snapshot first. Only legacy trades without one fall back to the current default lane.</p>
            {legacyFallbackCount > 0 ? <p>{legacyFallbackCount} active trade{legacyFallbackCount === 1 ? " is" : "s are"} using the current default strategy as a legacy fallback.</p> : null}
            <QuoteStatusLegend className="pt-2" />
          </div>
        </aside>
      </section>

      <section className="fin-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="fin-kicker">Strategy Refresh</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Updated score and follow-up AI recommendation</h2>
          </div>
          <span className="fin-chip">{activeTrades.length} active</span>
        </div>

        {loading ? <div className="fin-card mt-6 p-5 text-sm text-tds-dim">Refreshing every active trade against its saved strategy snapshot...</div> : null}
        {!loading && activeTrades.length === 0 ? <p className="mt-6 text-sm text-tds-dim">No active trades are open right now.</p> : null}

        <div className="mt-6 space-y-4">
          {activeTrades.map((trade) => {
            const refresh = refreshRows[trade.id];

            return (
              <div key={trade.id} className="fin-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-lg font-semibold text-tds-text">{trade.ticker}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${trade.direction === "LONG" ? "bg-tds-green/10 text-tds-green" : "bg-tds-red/10 text-tds-red"}`}>{trade.direction}</span>
                      {trade.conviction ? <span className="fin-chip">{trade.conviction}</span> : null}
                      <span className="fin-chip">{trade.source === "marketwatch" ? "MarketWatch" : "Thesis"}</span>
                      <span className="fin-chip">{trade.strategyName}</span>
                      {trade.strategyVersionNumber ? <span className="fin-chip">v{trade.strategyVersionNumber}</span> : null}
                      {trade.usesDefaultStrategyFallback ? <span className="fin-chip">Legacy fallback</span> : <span className="fin-chip">Snapshot</span>}
                      <QuoteStatusBadge status={trade.quoteStatus ?? null} provider={trade.quoteProvider ?? null} />
                    </div>
                    <p className="mt-3 text-sm text-tds-dim">Entry {trade.entryPrice.toFixed(2)} · Current {trade.currentPrice.toFixed(2)} · Risk {(trade.riskPct * 100).toFixed(2)}% · {trade.strategyMetrics.length} saved checks</p>
                    <p className="mt-2 text-sm text-tds-dim">{trade.strategyDescription}</p>
                  </div>

                  <div className="text-right">
                    <p className={`font-mono text-lg font-semibold ${trade.livePnl >= 0 ? "text-tds-green" : "text-tds-red"}`}>{trade.livePnl >= 0 ? "+" : "-"}{money(Math.abs(trade.livePnl))}</p>
                    <p className="mt-1 text-sm text-tds-dim">{trade.livePnlPct >= 0 ? "+" : ""}{trade.livePnlPct.toFixed(2)}%</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[140px_minmax(0,1fr)_auto]">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 px-4 py-4 text-center">
                    <p className="fin-kicker">Score</p>
                    <p className="mt-2 font-mono text-3xl text-tds-text">{refresh ? refresh.score : "--"}</p>
                    <p className="mt-2 text-xs text-tds-dim">{refresh ? `${refresh.passed}/${refresh.total} passed` : "Pending"}</p>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${refresh?.verdict === "GO" ? "bg-tds-green/10 text-tds-green" : refresh?.verdict === "CAUTION" ? "bg-tds-amber/10 text-tds-amber" : "bg-tds-red/10 text-tds-red"}`}>{refresh?.verdict ?? "PENDING"}</span>
                      {refresh?.fallback ? <span className="fin-chip">Fallback</span> : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-tds-text">{refresh?.summary ?? `Refreshing ${trade.strategyName} against current market conditions...`}</p>
                    {refresh?.edge ? <p className="mt-2 text-xs text-tds-dim">Edge: {refresh.edge}</p> : null}
                    {refresh?.risks ? <p className="mt-1 text-xs text-tds-dim">Risk: {refresh.risks}</p> : null}
                  </div>

                  <Link href={`/trade/${trade.id}`} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/80 bg-white px-4 text-sm font-semibold text-tds-text shadow-sm hover:bg-tds-wash">
                    Open trade
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <AnalyticsClient closedTrades={closedTrades} showHero={false} />
    </div>
  );
}