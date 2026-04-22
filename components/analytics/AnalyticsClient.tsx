"use client";

import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Activity, Scale, TrendingUp } from "lucide-react";
import {
  analyticsBySetup,
  analyticsBySource,
  analyticsBySourceRealized,
  analyticsByStrategy,
  buildCumulativeRSeries,
  calculateAnalytics,
  calculateRealizedAnalytics,
} from "@/lib/trading/analytics";
import { useLearnMode } from "@/components/learn/LearnModeContext";
import { ANALYTICS_GUIDE } from "@/lib/learn/explanations";
import type { Trade } from "@/types/trade";

type AnalyticsClientProps = {
  closedTrades: Trade[];
  showHero?: boolean;
};

type ReviewLane = "modeled" | "realized";

function formatR(value: number): string {
  if (!Number.isFinite(value)) {
    return "∞";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AnalyticsClient({ closedTrades, showHero = true }: AnalyticsClientProps) {
  const { learnMode } = useLearnMode();
  const [reviewLane, setReviewLane] = useState<ReviewLane>("modeled");

  const modeledAnalytics = calculateAnalytics(closedTrades);
  const realizedAnalytics = calculateRealizedAnalytics(closedTrades);
  const modeledBySource = analyticsBySource(closedTrades);
  const realizedBySource = analyticsBySourceRealized(closedTrades);

  const selectedAnalytics = reviewLane === "modeled" ? modeledAnalytics : realizedAnalytics;
  const selectedOutcomeCount = reviewLane === "modeled" ? modeledAnalytics.tradeCount : realizedAnalytics.capturedTradeCount;
  const setupMap = analyticsBySetup(closedTrades, reviewLane);
  const strategyMap = analyticsByStrategy(closedTrades, reviewLane);

  const setupRows = Object.entries(setupMap)
    .map(([setup, stats]) => ({ setup, ...stats }))
    .sort((a, b) => b.avgR - a.avgR);
  const strategyRows = Object.entries(strategyMap)
    .map(([strategy, stats]) => ({ strategy, ...stats }))
    .sort((a, b) => b.avgR - a.avgR);

  const maxAbsSetupR = setupRows.reduce((max, row) => Math.max(max, Math.abs(row.avgR)), 0) || 1;
  const maxAbsStrategyR = strategyRows.reduce((max, row) => Math.max(max, Math.abs(row.avgR)), 0) || 1;
  const captureRate = realizedAnalytics.tradeCount > 0 ? realizedAnalytics.capturedTradeCount / realizedAnalytics.tradeCount : 0;

  const trendLabel =
    selectedOutcomeCount < 5
      ? "Building"
      : selectedAnalytics.rollingExpectancy < selectedAnalytics.expectancy * 0.7
        ? "Degrading"
        : selectedAnalytics.rollingExpectancy > selectedAnalytics.expectancy * 1.3
          ? "Improving"
          : "Stable";

  const equityCurve = buildCumulativeRSeries(closedTrades, reviewLane);
  const reviewLaneLabel = reviewLane === "modeled" ? "Modeled System" : "Realized Execution";

  if (modeledAnalytics.tradeCount < 5) {
    return (
      <main className="analytics-terminal trade-terminal analytics-cockpit">
        <section className="surface-panel analytics-cockpit-hero p-6 sm:p-8">
          <p className="meta-label">{showHero ? "Performance Analytics" : "Historical Analytics"}</p>
          <h2 className="mt-3 font-[Iowan_Old_Style,Palatino_Linotype,Georgia,serif] text-[clamp(2rem,3vw,3rem)] font-semibold leading-[0.98] text-[#162331]">
            Not enough closed trades yet.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#4e6273]">
            Analytics unlock after 5 or more closed trades. You currently have {modeledAnalytics.tradeCount} of 5 closed trades available for statistical review.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#4e6273]">
            Realized execution analytics currently have {realizedAnalytics.capturedTradeCount} trade{realizedAnalytics.capturedTradeCount === 1 ? "" : "s"} with full exit capture.
          </p>
          <div className="analytics-preview-grid mt-6">
            <article className="analytics-preview-card">
              <p className="meta-label">Closed trades logged</p>
              <strong>{modeledAnalytics.tradeCount}</strong>
              <span>Statistical review opens at 5 closed trades.</span>
            </article>
            <article className="analytics-preview-card">
              <p className="meta-label">Trades remaining</p>
              <strong>{Math.max(5 - modeledAnalytics.tradeCount, 0)}</strong>
              <span>Needed before the expectancy cockpit unlocks.</span>
            </article>
            <article className="analytics-preview-card">
              <p className="meta-label">Realized coverage</p>
              <strong>{realizedAnalytics.capturedTradeCount}</strong>
              <span>Trades with complete exit capture.</span>
            </article>
          </div>
          <div className="analytics-preview-actions mt-6">
            <Link href="/trade/new" className="blind-eval-primary blind-eval-link">Log new trade</Link>
            <Link href="/archive" className="blind-eval-secondary blind-eval-link-secondary">Review archive</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="analytics-terminal trade-terminal analytics-cockpit">
      <section className="surface-panel analytics-cockpit-hero analytics-header-row">
        <div className="analytics-cockpit-hero-copy">
          <p className="meta-label">Performance Analytics</p>
          <h2>Portfolio Analytics</h2>
          <p className="page-intro">Performance attribution, expectancy quality, and execution discipline in a single review cockpit.</p>
        </div>
        <div className="analytics-summary-strip analytics-command-deck">
          <article className="override-budget-card analytics-lane-card">
            <p className="meta-label">Review Lane</p>
            <strong>
              {reviewLane === "modeled" ? "M" : "R"}
              <span>{reviewLaneLabel}</span>
            </strong>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setReviewLane("modeled")}
                className={reviewLane === "modeled" ? "primary-button h-10 min-h-10 px-4 text-[11px]" : "secondary-button h-10 min-h-10 px-4 text-[11px]"}
              >
                Modeled
              </button>
              <button
                type="button"
                onClick={() => setReviewLane("realized")}
                className={reviewLane === "realized" ? "primary-button h-10 min-h-10 px-4 text-[11px]" : "secondary-button h-10 min-h-10 px-4 text-[11px]"}
              >
                Realized
              </button>
            </div>
          </article>
          <article className="analytics-top-stat analytics-hero-stat">
            <p className="meta-label">Expectancy</p>
            <strong>{formatR(selectedAnalytics.expectancy)}</strong>
          </article>
          <article className="analytics-top-stat analytics-hero-stat">
            <p className="meta-label">Total P&amp;L</p>
            <strong className={reviewLane === "modeled" || realizedAnalytics.totalPnl >= 0 ? "positive" : "negative"}>
              {reviewLane === "modeled" ? formatR(selectedAnalytics.expectancy * selectedOutcomeCount) : formatMoney(realizedAnalytics.totalPnl)}
            </strong>
          </article>
        </div>
      </section>

      {showHero ? (
        <section className="analytics-kpi-grid analytics-kpi-shell">
          <article className="surface-panel analytics-kpi-card analytics-kpi-spotlight">
            <p className="meta-label">Modeled Expectancy</p>
            <strong>{formatR(modeledAnalytics.expectancy)}</strong>
            <span>{modeledAnalytics.tradeCount} trades in model sample</span>
          </article>
          <article className="surface-panel analytics-kpi-card analytics-kpi-spotlight">
            <p className="meta-label">Realized P&amp;L</p>
            <strong className={realizedAnalytics.totalPnl >= 0 ? "positive" : "negative"}>{formatMoney(realizedAnalytics.totalPnl)}</strong>
            <span>Captured exit math only</span>
          </article>
          <article className="surface-panel analytics-kpi-card analytics-kpi-spotlight">
            <p className="meta-label">Realized Coverage</p>
            <strong>{(captureRate * 100).toFixed(0)}%</strong>
            <span>{realizedAnalytics.capturedTradeCount}/{realizedAnalytics.tradeCount} trades captured</span>
          </article>
          <article className="surface-panel analytics-kpi-card analytics-kpi-spotlight">
            <p className="meta-label">Trend</p>
            <strong>{trendLabel}</strong>
            <span>Rolling vs overall expectancy</span>
          </article>
        </section>
      ) : null}

      {learnMode ? (
        <section className="surface-panel analytics-insight-card">
          <p className="meta-label">How To Read This View</p>
          <h3>Mechanical review notes</h3>
          <p className="mt-4">Win Rate: {ANALYTICS_GUIDE.winRate}</p>
          <p className="mt-2">Expectancy: {ANALYTICS_GUIDE.expectancy}</p>
          <p className="mt-2">Profit Factor: {ANALYTICS_GUIDE.profitFactor}</p>
          <p className="mt-2">Rolling Expectancy: {ANALYTICS_GUIDE.rolling}</p>
          <p className="mt-2">Modeled vs realized: modeled analytics normalize outcomes from your milestone flags, while realized analytics only count trades where actual exit capture exists.</p>
        </section>
      ) : null}

      {reviewLane === "realized" && realizedAnalytics.capturedTradeCount < realizedAnalytics.tradeCount ? (
        <div className="priority-card warn analytics-warning-callout">
          {realizedAnalytics.tradeCount - realizedAnalytics.capturedTradeCount} closed trade{realizedAnalytics.tradeCount - realizedAnalytics.capturedTradeCount === 1 ? " is" : "s are"} missing full exit capture and are excluded from realized analytics.
        </div>
      ) : null}

      <section className="analytics-kpi-grid analytics-kpi-shell analytics-kpi-shell-secondary">
        <article className="surface-panel analytics-kpi-card analytics-kpi-spotlight">
          <p className="meta-label">Win Rate</p>
          <strong>{(selectedAnalytics.winRate * 100).toFixed(1)}%</strong>
          <span>{selectedOutcomeCount} outcome{selectedOutcomeCount === 1 ? "" : "s"} in sample</span>
        </article>
        <article className="surface-panel analytics-kpi-card analytics-kpi-spotlight">
          <p className="meta-label">Expectancy</p>
          <strong>{formatR(selectedAnalytics.expectancy)}</strong>
          <span>Per-trade normalized edge</span>
        </article>
        <article className="surface-panel analytics-kpi-card analytics-kpi-spotlight">
          <p className="meta-label">Avg R-Multiple</p>
          <strong>{formatR(selectedAnalytics.avgWinR)}</strong>
          <span>Avg loss {formatR(selectedAnalytics.avgLossR)}</span>
        </article>
        <article className="surface-panel analytics-kpi-card analytics-kpi-spotlight">
          <p className="meta-label">Profit Factor</p>
          <strong>{Number.isFinite(selectedAnalytics.profitFactor) ? selectedAnalytics.profitFactor.toFixed(2) : "∞"}</strong>
          <span>Rolling {formatR(selectedAnalytics.rollingExpectancy)}</span>
        </article>
      </section>

      <section className="analytics-chart-grid analytics-chart-shell">
        <section className="surface-panel analytics-chart-panel wide-chart-panel analytics-chart-spotlight">
          <div className="analytics-panel-header">
            <div>
              <p className="meta-label">Equity Curve</p>
              <h3>Cumulative {reviewLane === "modeled" ? "R progression" : "captured R progression"}</h3>
            </div>
            <div className="analytics-legend-row">
              <span className="tag">Equity</span>
              <span className="tag">Rolling Expectancy</span>
            </div>
          </div>
          {equityCurve.length === 0 ? (
            <p className="mt-5 text-sm text-[#4e6273]">No {reviewLane} outcome series available yet.</p>
          ) : (
            <div className="analytics-frame large-analytics-frame">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={equityCurve}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="idx" tick={{ fill: "#6b7b8f", fontSize: 10 }} axisLine={{ stroke: "#d8e2ec" }} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7b8f", fontSize: 10 }} axisLine={{ stroke: "#d8e2ec" }} tickLine={false} />
                  <Bar dataKey="cumulativeR" radius={[4, 4, 0, 0]}>
                    {equityCurve.map((entry) => (
                      <Cell key={`bar-${entry.idx}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="surface-panel analytics-chart-panel narrow-analytics-panel analytics-chart-sidecar">
          <div className="analytics-panel-header">
            <div>
              <p className="meta-label">Source Breakdown</p>
              <h3>Edge by entry source</h3>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="priority-card calm">
              <p className="meta-label">Thesis Trades</p>
              <p className="mt-2 font-mono text-2xl text-[#162331]">
                {reviewLane === "modeled" ? formatR(modeledBySource.thesis.expectancy) : formatR(realizedBySource.thesis.expectancy)}
              </p>
              <p className="mt-1 text-xs text-[#4e6273]">
                {reviewLane === "modeled" ? `${modeledBySource.thesis.tradeCount} trades` : `${realizedBySource.thesis.capturedTradeCount} of ${realizedBySource.thesis.tradeCount} captured`}
              </p>
            </div>
            <div className="priority-card calm">
              <p className="meta-label">MarketWatch Trades</p>
              <p className="mt-2 font-mono text-2xl text-[#162331]">
                {reviewLane === "modeled" ? formatR(modeledBySource.marketwatch.expectancy) : formatR(realizedBySource.marketwatch.expectancy)}
              </p>
              <p className="mt-1 text-xs text-[#4e6273]">
                {reviewLane === "modeled" ? `${modeledBySource.marketwatch.tradeCount} trades` : `${realizedBySource.marketwatch.capturedTradeCount} of ${realizedBySource.marketwatch.tradeCount} captured`}
              </p>
            </div>
            <div className="priority-card calm">
              <p className="meta-label">Lane Summary</p>
              <div className="mt-2 space-y-1 text-xs text-[#4e6273]">
                <p>Trend: <span className="font-semibold text-[#162331]">{trendLabel}</span></p>
                <p>Win rate: <span className="font-semibold text-[#162331]">{(selectedAnalytics.winRate * 100).toFixed(1)}%</span></p>
                <p>Rolling exp: <span className="font-semibold text-[#162331]">{formatR(selectedAnalytics.rollingExpectancy)}</span></p>
              </div>
            </div>
          </div>
        </section>
      </section>

      <section className="analytics-insight-grid analytics-insight-shell">
        <article className="surface-panel analytics-insight-card analytics-insight-spotlight">
          <p className="meta-label">Setup Breakdown</p>
          <h3>Edge by setup type</h3>
          <div className="mt-5 space-y-4">
            {setupRows.length === 0 ? <p className="text-sm text-[#4e6273]">No {reviewLane} setup data yet.</p> : null}
            {setupRows.map((row) => {
              const blocks = Math.max(1, Math.round((Math.abs(row.avgR) / maxAbsSetupR) * 12));
              return (
                <div key={row.setup}>
                  <div className="mb-2 flex items-center justify-between text-xs text-[#4e6273]">
                    <span>{row.setup}</span>
                    <span className={row.avgR >= 0 ? "text-tds-green" : "text-tds-red"}>{formatR(row.avgR)} · {row.count}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: blocks }).map((_, i) => (
                      <span key={`${row.setup}-${i}`} className={`h-2 w-4 rounded-full ${row.avgR >= 0 ? "bg-tds-green" : "bg-tds-red"}`} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="surface-panel analytics-insight-card analytics-insight-spotlight">
          <p className="meta-label">Strategy Breakdown</p>
          <h3>Edge by saved strategy</h3>
          <div className="mt-5 space-y-4">
            {strategyRows.length === 0 ? <p className="text-sm text-[#4e6273]">No {reviewLane} strategy data yet.</p> : null}
            {strategyRows.map((row) => {
              const blocks = Math.max(1, Math.round((Math.abs(row.avgR) / maxAbsStrategyR) * 12));
              return (
                <div key={row.strategy}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[#4e6273]">
                    <span>{row.strategy}</span>
                    <span className={row.avgR >= 0 ? "text-tds-green" : "text-tds-red"}>{formatR(row.avgR)} · {row.count}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: blocks }).map((_, i) => (
                      <span key={`${row.strategy}-${i}`} className={`h-2 w-4 rounded-full ${row.avgR >= 0 ? "bg-tds-green" : "bg-tds-red"}`} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="surface-panel analytics-insight-card analytics-insight-spotlight">
          <p className="meta-label">Discipline Review</p>
          <h3>System health</h3>
          <div className="mt-5 space-y-3">
            <div className="priority-card calm flex items-start gap-3">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-tds-blue" />
              <div>
                <p className="meta-label">Modeled Sample</p>
                <p className="mt-1 text-sm text-[#162331]">{modeledAnalytics.tradeCount} closed trades contributing to system review.</p>
              </div>
            </div>
            <div className="priority-card calm flex items-start gap-3">
              <Scale className="mt-0.5 h-4 w-4 shrink-0 text-tds-amber" />
              <div>
                <p className="meta-label">Realized Coverage</p>
                <p className="mt-1 text-sm text-[#162331]">{realizedAnalytics.capturedTradeCount} of {realizedAnalytics.tradeCount} trades have full exit capture.</p>
              </div>
            </div>
            <div className="priority-card calm flex items-start gap-3">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-tds-green" />
              <div>
                <p className="meta-label">Lane Split</p>
                <p className="mt-1 text-sm text-[#162331]">Modeled uses T1/T2/T3 milestones. Realized uses actual captured exit math only.</p>
              </div>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
