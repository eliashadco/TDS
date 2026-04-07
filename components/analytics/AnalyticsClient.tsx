"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Activity, ArrowUpRight, Scale, TrendingUp } from "lucide-react";
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

  if (modeledAnalytics.tradeCount < 5) {
    return (
      <main className="space-y-6">
        <section className="fin-panel p-6 sm:p-8">
          <p className="fin-kicker">{showHero ? "Performance Analytics" : "Historical Analytics"}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-tds-text">Not enough closed trades yet.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-tds-dim">
            Analytics unlock after 5 or more closed trades. You currently have {modeledAnalytics.tradeCount} of 5 closed trades available for statistical review.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-tds-dim">
            Realized execution analytics currently have {realizedAnalytics.capturedTradeCount} trade{realizedAnalytics.capturedTradeCount === 1 ? "" : "s"} with full exit capture.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      {showHero ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_340px]">
          <div className="fin-hero px-7 py-8 sm:px-8 sm:py-9">
            <p className="fin-chip fin-chip-strong">Performance Analytics</p>
            <h1 className="mt-6 max-w-3xl text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              Separate system edge from execution capture before you decide what needs work.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/76 sm:text-base">
              Modeled analytics show how the playbook behaved in normalized R terms, while realized analytics only speak for trades with full exit capture. Keeping those lanes separate prevents misleading conclusions.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Modeled Expectancy</p>
                <p className="mt-2 font-mono text-3xl text-white">{formatR(modeledAnalytics.expectancy)}</p>
              </div>
              <div className="rounded-[24px] border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Realized P&amp;L</p>
                <p className="mt-2 font-mono text-3xl text-white">{formatMoney(realizedAnalytics.totalPnl)}</p>
              </div>
              <div className="rounded-[24px] border border-white/14 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">Realized Coverage</p>
                <p className="mt-2 text-2xl font-semibold text-white">{(captureRate * 100).toFixed(0)}%</p>
              </div>
            </div>
          </div>

          <aside className="fin-panel p-6">
            <p className="fin-kicker">Review Notes</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">System health</h2>
            <div className="mt-5 space-y-3">
              <div className="fin-card flex items-start gap-3 p-4">
                <Activity className="mt-0.5 h-5 w-5 text-tds-blue" />
                <div>
                  <p className="fin-kicker">Modeled Sample</p>
                  <p className="mt-1 text-sm text-tds-text">{modeledAnalytics.tradeCount} closed trades are contributing to the normalized system review.</p>
                </div>
              </div>
              <div className="fin-card flex items-start gap-3 p-4">
                <Scale className="mt-0.5 h-5 w-5 text-tds-amber" />
                <div>
                  <p className="fin-kicker">Realized Coverage</p>
                  <p className="mt-1 text-sm text-tds-text">{realizedAnalytics.capturedTradeCount} of {realizedAnalytics.tradeCount} closed trades have entry, stop, exit, and share capture.</p>
                </div>
              </div>
              <div className="fin-card flex items-start gap-3 p-4">
                <TrendingUp className="mt-0.5 h-5 w-5 text-tds-green" />
                <div>
                  <p className="fin-kicker">Lane Split</p>
                  <p className="mt-1 text-sm text-tds-text">Modeling uses T1, T2, and T3 milestone outcomes. Realized review only uses actual captured exit math.</p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      {learnMode ? (
        <section className="fin-panel p-6 text-sm leading-7 text-tds-dim">
          <p className="fin-kicker">How To Read This View</p>
          <p className="mt-4">Win Rate: {ANALYTICS_GUIDE.winRate}</p>
          <p className="mt-2">Expectancy: {ANALYTICS_GUIDE.expectancy}</p>
          <p className="mt-2">Profit Factor: {ANALYTICS_GUIDE.profitFactor}</p>
          <p className="mt-2">Rolling Expectancy: {ANALYTICS_GUIDE.rolling}</p>
          <p className="mt-2">Modeled vs realized: modeled analytics normalize outcomes from your milestone flags, while realized analytics only count trades where actual exit capture exists.</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="fin-card p-5">
          <p className="fin-kicker">Modeled Expectancy</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{formatR(modeledAnalytics.expectancy)}</p>
        </div>
        <div className="fin-card p-5">
          <p className="fin-kicker">Modeled Total R</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{formatR(modeledAnalytics.totalR)}</p>
        </div>
        <div className="fin-card p-5">
          <p className="fin-kicker">Realized Expectancy</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{formatR(realizedAnalytics.expectancy)}</p>
        </div>
        <div className="fin-card p-5">
          <p className="fin-kicker">Realized Total P&amp;L</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{formatMoney(realizedAnalytics.totalPnl)}</p>
        </div>
        <div className="fin-card p-5">
          <p className="fin-kicker">Realized Coverage</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{(captureRate * 100).toFixed(0)}%</p>
          <p className="mt-2 text-sm text-tds-dim">{realizedAnalytics.capturedTradeCount}/{realizedAnalytics.tradeCount} closed trades captured</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="fin-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="fin-kicker">Modeled Source Breakdown</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Normalized expectancy by entry source</h2>
            </div>
            <ArrowUpRight className="h-5 w-5 text-tds-dim" />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="fin-card p-5">
              <p className="fin-kicker">Thesis Trades</p>
              <p className="mt-3 font-mono text-3xl text-tds-text">{formatR(modeledBySource.thesis.expectancy)}</p>
              <p className="mt-2 text-sm text-tds-dim">Count {modeledBySource.thesis.tradeCount}</p>
            </div>
            <div className="fin-card p-5">
              <p className="fin-kicker">MarketWatch Trades</p>
              <p className="mt-3 font-mono text-3xl text-tds-text">{formatR(modeledBySource.marketwatch.expectancy)}</p>
              <p className="mt-2 text-sm text-tds-dim">Count {modeledBySource.marketwatch.tradeCount}</p>
            </div>
          </div>
        </div>

        <div className="fin-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="fin-kicker">Realized Source Breakdown</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Captured execution by entry source</h2>
            </div>
            <ArrowUpRight className="h-5 w-5 text-tds-dim" />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="fin-card p-5">
              <p className="fin-kicker">Thesis Trades</p>
              <p className="mt-3 font-mono text-3xl text-tds-text">{formatR(realizedBySource.thesis.expectancy)}</p>
              <p className="mt-2 text-sm text-tds-dim">Captured {realizedBySource.thesis.capturedTradeCount} of {realizedBySource.thesis.tradeCount}</p>
            </div>
            <div className="fin-card p-5">
              <p className="fin-kicker">MarketWatch Trades</p>
              <p className="mt-3 font-mono text-3xl text-tds-text">{formatR(realizedBySource.marketwatch.expectancy)}</p>
              <p className="mt-2 text-sm text-tds-dim">Captured {realizedBySource.marketwatch.capturedTradeCount} of {realizedBySource.marketwatch.tradeCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="fin-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="fin-kicker">Review Lane</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Choose which evidence lane to inspect</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setReviewLane("modeled")}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${reviewLane === "modeled" ? "border-blue-200 bg-blue-50 text-tds-blue" : "border-white/80 bg-white text-tds-dim hover:bg-tds-wash"}`}
            >
              Modeled System
            </button>
            <button
              type="button"
              onClick={() => setReviewLane("realized")}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${reviewLane === "realized" ? "border-blue-200 bg-blue-50 text-tds-blue" : "border-white/80 bg-white text-tds-dim hover:bg-tds-wash"}`}
            >
              Realized Execution
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <p className="text-sm leading-7 text-tds-dim">
              {reviewLane === "modeled"
                ? "Modeled review normalizes outcomes from the stored tranche milestone flags. Use it to judge whether the strategy itself is producing edge, even when exact exit capture is incomplete."
                : "Realized review only counts trades with full execution capture: entry, stop, exit price, and share size. Use it to judge whether actual exits are preserving the modeled edge."}
            </p>
            {reviewLane === "realized" && realizedAnalytics.capturedTradeCount < realizedAnalytics.tradeCount ? (
              <div className="mt-4 rounded-[22px] border border-tds-amber/25 bg-tds-amber/10 px-4 py-3 text-sm text-tds-text">
                {realizedAnalytics.tradeCount - realizedAnalytics.capturedTradeCount} closed trade{realizedAnalytics.tradeCount - realizedAnalytics.capturedTradeCount === 1 ? " is" : "s are"} missing full exit capture, so they are excluded from realized execution analytics.
              </div>
            ) : null}
          </div>

          <div className="fin-card p-5">
            <p className="fin-kicker">Lane Summary</p>
            <div className="mt-3 space-y-2 text-sm text-tds-dim">
              <p>Trend: <span className="text-tds-text">{trendLabel}</span></p>
              <p>Win rate: <span className="text-tds-text">{(selectedAnalytics.winRate * 100).toFixed(1)}%</span></p>
              <p>Rolling expectancy: <span className="text-tds-text">{formatR(selectedAnalytics.rollingExpectancy)}</span></p>
              <p>Outcome sample: <span className="text-tds-text">{selectedOutcomeCount}</span></p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="fin-card p-5">
          <p className="fin-kicker">Win Rate</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{(selectedAnalytics.winRate * 100).toFixed(1)}%</p>
        </div>
        <div className="fin-card p-5">
          <p className="fin-kicker">Expectancy</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{formatR(selectedAnalytics.expectancy)}</p>
        </div>
        <div className="fin-card p-5">
          <p className="fin-kicker">Avg Win</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{formatR(selectedAnalytics.avgWinR)}</p>
        </div>
        <div className="fin-card p-5">
          <p className="fin-kicker">Avg Loss</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{formatR(selectedAnalytics.avgLossR)}</p>
        </div>
        <div className="fin-card p-5">
          <p className="fin-kicker">Profit Factor</p>
          <p className="mt-3 font-mono text-3xl text-tds-text">{Number.isFinite(selectedAnalytics.profitFactor) ? selectedAnalytics.profitFactor.toFixed(2) : "∞"}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="fin-panel p-6">
          <p className="fin-kicker">Setup Breakdown</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Average edge by setup</h2>
          <div className="mt-5 space-y-4">
            {setupRows.length === 0 ? <p className="text-sm text-tds-dim">No {reviewLane} setup data is available yet.</p> : null}
            {setupRows.map((row) => {
              const blocks = Math.max(1, Math.round((Math.abs(row.avgR) / maxAbsSetupR) * 12));
              return (
                <div key={row.setup}>
                  <div className="mb-2 flex items-center justify-between text-sm text-tds-dim">
                    <span>{row.setup}</span>
                    <span className={row.avgR >= 0 ? "text-tds-green" : "text-tds-red"}>{formatR(row.avgR)} · {row.count}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: blocks }).map((_, index) => (
                      <span key={`${row.setup}-${index}`} className={`h-2.5 w-5 rounded-full ${row.avgR >= 0 ? "bg-tds-green" : "bg-tds-red"}`} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="fin-panel p-6">
          <p className="fin-kicker">Strategy Breakdown</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Average edge by saved strategy</h2>
          <div className="mt-5 space-y-4">
            {strategyRows.length === 0 ? <p className="text-sm text-tds-dim">No {reviewLane} strategy data is available yet.</p> : null}
            {strategyRows.map((row) => {
              const blocks = Math.max(1, Math.round((Math.abs(row.avgR) / maxAbsStrategyR) * 12));
              return (
                <div key={row.strategy}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm text-tds-dim">
                    <span>{row.strategy}</span>
                    <span className={row.avgR >= 0 ? "text-tds-green" : "text-tds-red"}>{formatR(row.avgR)} · {row.count}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: blocks }).map((_, index) => (
                      <span key={`${row.strategy}-${index}`} className={`h-2.5 w-5 rounded-full ${row.avgR >= 0 ? "bg-tds-green" : "bg-tds-red"}`} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="fin-panel p-6">
        <p className="fin-kicker">Equity Curve</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Cumulative {reviewLane === "modeled" ? "R progression" : "captured R progression"}</h2>
        {equityCurve.length === 0 ? <p className="mt-5 text-sm text-tds-dim">No {reviewLane} outcome series is available yet.</p> : null}
        {equityCurve.length > 0 ? (
          <div className="mt-6 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={equityCurve}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="idx" tick={{ fill: "#6b7b8f", fontSize: 10 }} axisLine={{ stroke: "#d8e2ec" }} tickLine={false} />
                <YAxis tick={{ fill: "#6b7b8f", fontSize: 10 }} axisLine={{ stroke: "#d8e2ec" }} tickLine={false} />
                <Bar dataKey="cumulativeR" radius={[6, 6, 0, 0]}>
                  {equityCurve.map((entry) => (
                    <Cell key={`bar-${entry.idx}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </section>
    </main>
  );
}