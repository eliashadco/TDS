"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import StrategyStatisticsPanel from "@/components/analytics/StrategyStatisticsPanel";
import type { DecisionQualityResponse, StrategyAnalyticsResponse } from "@/types/analytics";
import { STRATEGY_SAMPLE_MINIMUM } from "@/types/analytics";
import type { TradeMode } from "@/types/trade";

function fmtPctFraction(x: number | null, digits = 1): string {
  if (x == null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

function fmtR(x: number | null, digits = 2): string {
  if (x == null || Number.isNaN(x)) return "—";
  const sign = x >= 0 ? "+" : "";
  return `${sign}${x.toFixed(digits)}R`;
}

type StrategyReportClientProps = {
  strategyId: string | null;
  strategyName: string;
  mode: TradeMode | null;
};

export default function StrategyReportClient({ strategyId, strategyName, mode }: StrategyReportClientProps) {
  const [strategyReport, setStrategyReport] = useState<StrategyAnalyticsResponse | null>(null);
  const [decisions, setDecisions] = useState<DecisionQualityResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(strategyId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (!strategyId) {
      setStrategyReport(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [sRes, dRes] = await Promise.all([
        fetch(`/api/analytics/strategy/${strategyId}`, { cache: "no-store" }),
        fetch("/api/analytics/decisions", { cache: "no-store" }),
      ]);

      if (!sRes.ok) {
        const payload = (await sRes.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "Strategy analytics failed");
      }

      const sJson = (await sRes.json()) as StrategyAnalyticsResponse;
      if (sJson.empty) {
        setStrategyReport({ empty: true });
      } else {
        setStrategyReport(sJson);
      }

      if (dRes.ok) {
        setDecisions((await dRes.json()) as DecisionQualityResponse);
      } else {
        setDecisions(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
      setStrategyReport(null);
    } finally {
      setLoading(false);
    }
  }, [strategyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const modeHint = mode ? `Lane · ${mode === "daytrade" ? "Day trade" : `${mode.charAt(0).toUpperCase()}${mode.slice(1)}`}` : "Lane · not set";

  if (!strategyId) {
    return (
      <div className="surface-panel rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.28)]">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="meta-label">Strategy proof</p>
            <h2 className="mt-1 text-xl font-semibold text-tds-text">Select a default strategy for your workspace</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-tds-dim">
              Proof metrics are computed from <strong className="text-tds-text/90">strategy_outcomes</strong> rows produced when you submit a structured post-trade review. Choose an active strategy in
              your lane so this terminal can load attributed outcomes.
            </p>
            <Link href="/settings/profile" className="secondary-button mt-5 inline-flex">
              Open profile / workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (strategyReport?.empty) {
    return (
      <div className="surface-panel rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.28)]">
        <p className="meta-label">Strategy proof</p>
        <h2 className="mt-1 text-xl font-semibold text-tds-text">{strategyName}</h2>
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-tds-dim">
          No <strong className="text-tds-text">strategy_outcomes</strong> yet for this strategy. Close trades and submit structured reviews to populate proof metrics.
        </p>
      </div>
    );
  }

  const proof = strategyReport?.proof;

  return (
    <div className="analytics-terminal trade-terminal flex flex-col gap-4">
      <section className="surface-panel rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.28)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="meta-label">Strategy proof</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-tds-text">{strategyName}</h2>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-tds-dim">{modeHint}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-tds-text hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
        ) : null}

        {strategyReport?.sampleWarning ? (
          <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Sample size is below the architecture minimum ({STRATEGY_SAMPLE_MINIMUM} closed reviews). Expectancy and win rate are descriptive only until the book grows.
            </p>
          </div>
        ) : null}

        {loading && !proof ? (
          <p className="mt-6 text-sm text-tds-dim">Loading attributed outcomes…</p>
        ) : null}

        {proof ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Sample size" value={String(proof.sampleSize)} hint="Review-linked trades" />
            <StatCard label="Win rate (all)" value={fmtPctFraction(proof.winRateAll)} hint="Fraction of positive R" />
            <StatCard label="Expectancy" value={fmtR(proof.expectancyAll, 3)} hint="Mean outcome R" />
            <StatCard label="Profit factor" value={proof.profitFactor != null ? proof.profitFactor.toFixed(2) : "—"} hint="Gross wins ÷ gross losses" />
            <StatCard label="Win rate · clean" value={fmtPctFraction(proof.winRateClean)} hint="No override flag" />
            <StatCard label="Win rate · override" value={fmtPctFraction(proof.winRateOverride)} hint="Had override" />
            <StatCard label="Expectancy · clean" value={fmtR(proof.expectancyClean, 3)} hint="Rule-following book" />
            <StatCard label="Expectancy · override" value={fmtR(proof.expectancyOverride, 3)} hint="Discretionary drift" />
            <StatCard label="Override rate" value={fmtPctFraction(proof.overrideRate)} hint="Share of trades" />
            <StatCard label="Override cost (Σ R)" value={fmtR(proof.overrideCostTotalR, 3)} hint="Signed ledger sum" />
            <StatCard label="Avg override cost" value={fmtR(proof.overrideCostAvgR, 3)} hint="Per flagged trade" />
            <StatCard label="Rule-path delta" value={fmtR(proof.ruleFollowingDeltaAvgR, 3)} hint="Mean R − estimated rule R" />
            <StatCard label="Max loss streak" value={String(proof.maxConsecutiveLosses)} hint="Historical run" />
            <StatCard label="Current loss streak" value={String(proof.currentLossStreak)} hint="From latest closes" />
            <StatCard label="Target capture (2R)" value={fmtPctFraction(proof.targetCaptureEfficiency)} hint="Touched 2R before exit" />
            <StatCard label="Avg MAE (R)" value={proof.avgMaeR != null ? proof.avgMaeR.toFixed(3) : "—"} hint="Mean adverse excursion" />
            <StatCard label="Avg MFE (R)" value={proof.avgMfeR != null ? proof.avgMfeR.toFixed(3) : "—"} hint="Mean favorable excursion" />
          </div>
        ) : null}

      </section>

      {strategyReport?.advanced ? (
        <StrategyStatisticsPanel
          advanced={strategyReport.advanced}
          sampleWarning={strategyReport.sampleWarning}
          proofSampleSize={proof?.sampleSize ?? 0}
        />
      ) : null}

      {proof && proof.sampleSize > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <BreakdownTable title="Setup tags (trade may appear in multiple)" rows={proof.setupPerformance.slice(0, 12)} />
          <BreakdownTable title="Execution classification" rows={proof.executionPerformance} />
          <BreakdownTable title="Direction" rows={proof.directionPerformance} />
          <section className="surface-panel rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-[0_20px_55px_-42px_rgba(15,23,42,0.22)]">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-tds-dim" />
              <h3 className="text-sm font-semibold text-tds-text">Decision quality · account</h3>
            </div>
            {decisions ? (
              <div className="mt-4 space-y-4 text-sm">
                <p className="text-xs text-tds-dim">
                  {decisions.totals.outcomes} outcomes across {decisions.totals.strategiesRepresented}{" "}
                  {decisions.totals.strategiesRepresented === 1 ? "strategy" : "strategies"}
                </p>
                <MiniTable
                  headers={["Execution", "n", "Avg R", "Win %"]}
                  rows={decisions.byExecution.slice(0, 8).map((r) => ({
                    cells: [r.key, String(r.count), fmtR(r.avgR, 2), fmtPctFraction(r.winRate)],
                  }))}
                />
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-tds-dim">By strategy</h4>
                <MiniTable
                  headers={["Strategy", "n", "E[R]", "Win %", "Ov %", "Ov ΣR"]}
                  rows={decisions.byStrategy.slice(0, 10).map((r) => ({
                    cells: [
                      r.strategyName,
                      String(r.sampleSize),
                      fmtR(r.expectancyR, 2),
                      fmtPctFraction(r.winRate),
                      fmtPctFraction(r.overrideRate),
                      fmtR(r.overrideCostTotalR, 2),
                    ],
                  }))}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-tds-dim">Decision quality rollup unavailable.</p>
            )}
          </section>
        </div>
      ) : null}

      {strategyReport?.statistics?.last_computed_at ? (
        <p className="text-center text-[11px] uppercase tracking-[0.14em] text-tds-dim">
          Cache updated {new Date(strategyReport.statistics.last_computed_at).toLocaleString("en-US")}
        </p>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3.5">
      <p className="meta-label">{label}</p>
      <strong className="mt-2 block font-mono text-lg text-tds-text">{value}</strong>
      <p className="mt-1 text-[11px] text-tds-dim">{hint}</p>
    </article>
  );
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; count: number; avgR: number | null; winRate: number | null }>;
}) {
  return (
    <section className="surface-panel rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-[0_20px_55px_-42px_rgba(15,23,42,0.22)]">
      <h3 className="text-sm font-semibold text-tds-text">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-tds-dim">No rows.</p>
      ) : (
        <MiniTable
          headers={["Key", "n", "Avg R", "Win %"]}
          rows={rows.map((r) => ({
            cells: [r.key, String(r.count), fmtR(r.avgR, 2), fmtPctFraction(r.winRate)],
          }))}
        />
      )}
    </section>
  );
}

function MiniTable({ headers, rows }: { headers: string[]; rows: Array<{ cells: string[] }> }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.12em] text-tds-dim">
            {headers.map((h) => (
              <th key={h} className="pb-2 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 text-tds-text last:border-0">
              {row.cells.map((c, j) => (
                <td key={j} className="py-2 pr-3 font-mono">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
