"use client";

import type { ReactNode } from "react";
import type { AdvancedStatisticsPack } from "@/types/analytics";
import { ADVANCED_SAMPLE_MINIMUM, STRATEGY_SAMPLE_MINIMUM } from "@/types/analytics";
import { AlertTriangle } from "lucide-react";

function pctFrac(x: number | null, digits = 1): string {
  if (x == null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

function fmtR(x: number | null, digits = 3): string {
  if (x == null || Number.isNaN(x)) return "—";
  const sign = x >= 0 ? "+" : "";
  return `${sign}${x.toFixed(digits)}R`;
}

function fmtBand(b: AdvancedStatisticsPack["distribution"]["all"]["bands"]): string {
  const keys = ["p10", "p25", "p50", "p75", "p90"] as const;
  const labels = ["P10", "P25", "P50", "P75", "P90"];
  return labels.map((label, i) => `${label} ${b[keys[i]!] != null ? b[keys[i]!]!.toFixed(2) : "—"}`).join(" · ");
}

type StrategyStatisticsPanelProps = {
  advanced: AdvancedStatisticsPack;
  sampleWarning: boolean;
  proofSampleSize: number;
};

export default function StrategyStatisticsPanel({ advanced, sampleWarning, proofSampleSize }: StrategyStatisticsPanelProps) {
  const { maeMfe, distribution, drawdown, confidence, holding, parameterLatency, targetCapture } = advanced;

  const excursionHeaders = ["Key", "n", "Med MAE", "Med MFE"];

  return (
    <section className="surface-panel rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.22)] sm:p-6">
      <div>
        <p className="meta-label">Advanced statistics pack</p>
        <h3 className="mt-1 text-lg font-semibold text-tds-text">Seven retrospective diagnostics (PR 8)</h3>
        <p className="mt-2 text-xs leading-relaxed text-tds-dim">{advanced.disclaimer}</p>
        <p className="mt-1 text-xs text-tds-dim">{advanced.retrospectiveNote}</p>
      </div>

      {sampleWarning ? (
        <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Bandwidth metrics ({proofSampleSize} trades) sit below the {STRATEGY_SAMPLE_MINIMUM}-trade gate — interpret MAE/MFE, drawdown shape, and bootstrap intervals as exploratory only.
          </p>
        </div>
      ) : null}

      {proofSampleSize > 0 && proofSampleSize < ADVANCED_SAMPLE_MINIMUM ? (
        <div className="mt-3 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            n = {proofSampleSize} — below the {ADVANCED_SAMPLE_MINIMUM}-trade advanced-statistics floor (Hard Rule 9). Drawdown shape, bootstrap confidence intervals, and holding-time ratios are particularly unreliable at this sample size. Do not act on these numbers.
          </p>
        </div>
      ) : null}

      <div className="mt-8 space-y-10">
        <Block title="A · MAE / MFE in R" subtitle="Pain and reward excursion — avg / median plus splits.">
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Median MAE" value={maeMfe.medianMaeR != null ? maeMfe.medianMaeR.toFixed(3) : "—"} />
            <MiniStat label="Avg MAE" value={maeMfe.avgMaeR != null ? maeMfe.avgMaeR.toFixed(3) : "—"} />
            <MiniStat label="Median MFE" value={maeMfe.medianMfeR != null ? maeMfe.medianMfeR.toFixed(3) : "—"} />
            <MiniStat label="Avg MFE" value={maeMfe.avgMfeR != null ? maeMfe.avgMfeR.toFixed(3) : "—"} />
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <DataTable
              title="By setup tag"
              headers={excursionHeaders}
              rows={maeMfe.bySetup.slice(0, 12).map((r) => [
                r.key,
                String(r.count),
                r.medianMaeR != null ? r.medianMaeR.toFixed(3) : "—",
                r.medianMfeR != null ? r.medianMfeR.toFixed(3) : "—",
              ])}
            />
            <DataTable
              title="By execution type"
              headers={excursionHeaders}
              rows={maeMfe.byExecution.map((r) => [
                r.key,
                String(r.count),
                r.medianMaeR != null ? r.medianMaeR.toFixed(3) : "—",
                r.medianMfeR != null ? r.medianMfeR.toFixed(3) : "—",
              ])}
            />
          </div>
        </Block>

        <Block title="B · Distribution profile" subtitle="Median, variability, and percentile bands on outcome R.">
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <DistCard label="All trades" slice={distribution.all} />
            <DistCard label="Clean (no override)" slice={distribution.clean} />
            <DistCard label="Override flagged" slice={distribution.override} />
          </div>
        </Block>

        <Block title="C · Drawdown & recovery (cumulative R curve)" subtitle="Closed-trade equity path in R units — not dollars.">
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MiniStat label="Max drawdown" value={fmtR(-drawdown.maxDrawdownR, 3)} hint="Peak-to-trough R" />
            <MiniStat label="Trail vs peak" value={fmtR(-drawdown.currentDrawdownR, 3)} hint="Latest cumulative dip" />
            <MiniStat label="Max DD span" value={`${drawdown.maxDrawdownDurationTrades} trades`} />
            <MiniStat label="Recovery factor" value={drawdown.recoveryFactor != null ? drawdown.recoveryFactor.toFixed(2) : "—"} hint="Net R ÷ max DD" />
            <MiniStat label="Net cumulative R" value={fmtR(drawdown.netCumulativeR, 3)} />
          </div>
          <p className="mt-3 font-mono text-[11px] text-tds-dim">
            Last segment of cumulative R:{" "}
            {drawdown.cumulativeCurve
              .slice(-8)
              .map((p) => `#${p.tradeIndex}→${p.cumulativeR.toFixed(2)}`)
              .join(" · ") || "—"}
          </p>
          <DataTable
            title="Drawdown · strategy version slices"
            headers={["Version", "Trades", "Max DD (R)"]}
            rows={drawdown.byStrategyVersion.slice(0, 10).map((v) => [v.versionKey, String(v.tradeCount), v.maxDrawdownR.toFixed(3)])}
          />
        </Block>

        <Block title="D · Confidence bands (95%)" subtitle={confidence.note}>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MiniStat
              label="Win rate Wilson interval"
              value={
                confidence.winRate95 ? `${pctFrac(confidence.winRate95.low)} – ${pctFrac(confidence.winRate95.high)}` : "—"
              }
            />
            <MiniStat
              label="Expectancy bootstrap interval"
              value={
                confidence.expectancy95 ? `${fmtR(confidence.expectancy95.low, 3)} – ${fmtR(confidence.expectancy95.high, 3)}` : "—"
              }
            />
          </div>
        </Block>

        <Block title="E · Holding-time efficiency" subtitle={holding.proxyNote}>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Avg hold (days)" value={holding.avgHoldDays != null ? holding.avgHoldDays.toFixed(2) : "—"} />
            <MiniStat label="Median hold (days)" value={holding.medianHoldDays != null ? holding.medianHoldDays.toFixed(2) : "—"} />
            <MiniStat label="Median hold · 1R touch" value={holding.medianHoldDaysAmongTouched1R != null ? holding.medianHoldDaysAmongTouched1R.toFixed(2) : "—"} />
            <MiniStat label="Early exit rate" value={pctFrac(holding.earlyExitRate)} hint="No 1R touch tagged" />
          </div>
        </Block>

        <Block title="F · Parameter failure latency" subtitle={parameterLatency.note}>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MiniStat label="Avg days to failure" value={parameterLatency.avgDaysToFailure != null ? parameterLatency.avgDaysToFailure.toFixed(2) : "—"} />
            <MiniStat label="Median days to failure" value={parameterLatency.medianDaysToFailure != null ? parameterLatency.medianDaysToFailure.toFixed(2) : "—"} />
          </div>
          <DataTable title="Buckets" headers={["Window", "Count"]} rows={parameterLatency.buckets.map((b) => [b.label, String(b.count)])} />
          <DataTable
            title="Median days to failure · by setup (trades with failure timestamp)"
            headers={["Setup", "n", "Med days"]}
            rows={parameterLatency.bySetup.slice(0, 12).map((r) => [
              r.key,
              String(r.count),
              r.medianDaysToFailure != null ? r.medianDaysToFailure.toFixed(2) : "—",
            ])}
          />
        </Block>

        <Block
          title="G · Target capture & realized / MFE"
          subtitle="Touch rates plus mean outcome_R ÷ MFE_R where MFE is recorded (reward capture proxy)."
        >
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="1R touch rate" value={pctFrac(targetCapture.touchRate1R)} />
            <MiniStat label="2R touch rate" value={pctFrac(targetCapture.touchRate2R)} />
            <MiniStat label="3R touch rate" value={pctFrac(targetCapture.touchRate3R)} />
            <MiniStat label="Avg realized / MFE" value={targetCapture.avgRealizedPerMfe != null ? targetCapture.avgRealizedPerMfe.toFixed(3) : "—"} />
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <DataTable
              title="Efficiency · execution"
              headers={["Execution", "n", "Avg R/MFE"]}
              rows={targetCapture.byExecution.slice(0, 12).map((r) => [
                r.key,
                String(r.count),
                r.avgOutcomePerMfe != null ? r.avgOutcomePerMfe.toFixed(3) : "—",
              ])}
            />
            <DataTable
              title="Efficiency · setup"
              headers={["Setup", "n", "Avg R/MFE"]}
              rows={targetCapture.bySetup.slice(0, 12).map((r) => [
                r.key,
                String(r.count),
                r.avgOutcomePerMfe != null ? r.avgOutcomePerMfe.toFixed(3) : "—",
              ])}
            />
          </div>
        </Block>
      </div>
    </section>
  );
}

function Block({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-tds-text">{title}</h4>
      <p className="mt-1 text-xs text-tds-dim">{subtitle}</p>
      {children}
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2.5">
      <p className="meta-label text-[10px]">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-tds-text">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-tds-dim">{hint}</p> : null}
    </article>
  );
}

function DistCard({ label, slice }: { label: string; slice: AdvancedStatisticsPack["distribution"]["all"] }) {
  return (
    <article className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-tds-text">{label}</p>
      <p className="mt-2 font-mono text-sm text-tds-dim">n = {slice.count}</p>
      <p className="mt-2 font-mono text-sm">Median {slice.medianR != null ? `${slice.medianR.toFixed(3)}R` : "—"}</p>
      <p className="mt-1 font-mono text-xs text-tds-dim">σ {slice.stdDevR != null ? slice.stdDevR.toFixed(3) : "—"}</p>
      <p className="mt-3 text-[11px] leading-relaxed text-tds-dim">{fmtBand(slice.bands)}</p>
    </article>
  );
}

function DataTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <p className="text-xs font-semibold text-tds-text">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-tds-dim">No rows.</p>
      ) : (
        <table className="mt-2 w-full border-collapse text-left text-xs">
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
                {row.map((c, j) => (
                  <td key={j} className="py-2 pr-3 font-mono">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
