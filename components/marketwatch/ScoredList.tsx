"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConvictionTier } from "@/types/trade";
import type { StrategySnapshot } from "@/types/strategy";

export type ScoredMover = {
  ticker: string;
  name: string;
  direction: "LONG" | "SHORT";
  score: number;
  total: number;
  passRate: number;
  verdict: "GO" | "CAUTION" | "SKIP";
  note: string;
  conviction: ConvictionTier | null;
  fScore: number;
  tScore: number;
  fTotal: number;
  tTotal: number;
  scores: Record<string, 0 | 1>;
  notes: Record<string, string>;
  entry: number | null;
  stop: number | null;
  price: number;
  reason: string;
  strategyId: string;
  strategyVersionId: string | null;
  strategyLabel: string;
  strategyDetail: string;
  strategySnapshot: StrategySnapshot;
  strategyMetricIds: string[];
  setupTypes: string[];
  conditions: string[];
  chartPattern: string;
  thesisSummary: string;
  triggerLevel: number | null;
  updatedAt?: string | null;
};

type ScoredListProps = {
  items: ScoredMover[];
  equity: number;
  loadingKey: string | null;
  onEntryChange: (strategyId: string, ticker: string, direction: "LONG" | "SHORT", value: number | null) => void;
  onStopChange: (strategyId: string, ticker: string, direction: "LONG" | "SHORT", value: number | null) => void;
  onDeploy: (item: ScoredMover) => void;
};

function DirectionBadge({ direction }: { direction: "LONG" | "SHORT" }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${direction === "LONG" ? "bg-tds-green/10 text-tds-green" : "bg-tds-red/10 text-tds-red"}`}>
      {direction}
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: ScoredMover["verdict"] }) {
  const classes =
    verdict === "GO"
      ? "bg-tds-green/10 text-tds-green"
      : verdict === "CAUTION"
        ? "bg-tds-amber/10 text-tds-amber"
        : "bg-tds-red/10 text-tds-red";

  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${classes}`}>{verdict}</span>;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatUpdatedAt(value?: string | null): string {
  if (!value) {
    return "Not saved yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTrigger(triggerLevel: number | null): string {
  if (triggerLevel == null || !Number.isFinite(triggerLevel)) {
    return "Pending trigger";
  }

  return triggerLevel.toFixed(2);
}

function getWorkbenchKey(item: ScoredMover): string {
  return `${item.strategyId}:${item.ticker}:${item.direction}`;
}

export default function ScoredList({ items, equity, loadingKey, onEntryChange, onStopChange, onDeploy }: ScoredListProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/75 bg-white/88 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.24)]">
      <div className="overflow-x-auto">
        <table className="min-w-[1260px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/92 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-tds-dim">
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Strategy</th>
              <th className="px-4 py-3">Planner</th>
              <th className="px-4 py-3">Thesis Summary</th>
              <th className="px-4 py-3 text-right">Shares</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const rPerShare = item.entry != null && item.stop != null ? Math.abs(item.entry - item.stop) : 0;
              const lockedRisk = item.conviction ? equity * item.conviction.risk : 0;
              const shares = item.conviction && rPerShare > 0 ? Math.floor(lockedRisk / rPerShare) : 0;
              const itemKey = getWorkbenchKey(item);

              return (
                <tr key={itemKey} className={index % 2 === 0 ? "bg-white align-top" : "bg-slate-50/55 align-top"}>
                  <td className="border-t border-slate-200/70 px-4 py-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-semibold text-tds-text">{item.ticker}</span>
                        <DirectionBadge direction={item.direction} />
                        <VerdictBadge verdict={item.verdict} />
                        {item.conviction ? <span className="inline-tag neutral">{item.conviction.tier}</span> : null}
                      </div>
                      <p className="text-xs uppercase tracking-[0.14em] text-tds-dim">{item.name}</p>
                      <p className="text-xs text-tds-dim">Saved {formatUpdatedAt(item.updatedAt)}</p>
                    </div>
                  </td>
                  <td className="border-t border-slate-200/70 px-4 py-4">
                    <div className="max-w-[260px] space-y-2">
                      <p className="font-semibold text-tds-text">{item.strategyLabel}</p>
                      <p className="text-sm leading-6 text-tds-dim">{item.strategyDetail}</p>
                      <p className="text-xs uppercase tracking-[0.14em] text-tds-dim">
                        {item.score}/{item.total} passed · {Math.round(item.passRate * 100)}% pass rate · {item.strategyMetricIds.length} checks
                      </p>
                    </div>
                  </td>
                  <td className="border-t border-slate-200/70 px-4 py-4">
                    <div className="grid min-w-[280px] gap-3 sm:grid-cols-2">
                      <Input
                        type="number"
                        value={item.entry ?? ""}
                        onChange={(event) => onEntryChange(item.strategyId, item.ticker, item.direction, event.target.value ? Number(event.target.value) : null)}
                        placeholder="Entry"
                      />
                      <Input
                        type="number"
                        value={item.stop ?? ""}
                        onChange={(event) => onStopChange(item.strategyId, item.ticker, item.direction, event.target.value ? Number(event.target.value) : null)}
                        placeholder="Stop"
                      />
                    </div>
                    <div className="mt-3 space-y-1 text-xs uppercase tracking-[0.14em] text-tds-dim">
                      <p>Trigger {formatTrigger(item.triggerLevel)}</p>
                      <p>{item.conviction ? `Conviction ${item.conviction.tier} (${(item.conviction.risk * 100).toFixed(0)}%)` : "Conviction unavailable"}</p>
                    </div>
                  </td>
                  <td className="border-t border-slate-200/70 px-4 py-4">
                    <div className="max-w-[360px] space-y-2">
                      <p className="text-sm leading-6 text-tds-text">{item.thesisSummary}</p>
                      <p className="text-sm leading-6 text-tds-dim">{item.note}</p>
                    </div>
                  </td>
                  <td className="border-t border-slate-200/70 px-4 py-4 text-right">
                    <p className="font-mono text-2xl text-tds-text">{shares}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-tds-dim">Risk {money(lockedRisk)}</p>
                  </td>
                  <td className="border-t border-slate-200/70 px-4 py-4 text-right">
                    <Button
                      type="button"
                      disabled={loadingKey === itemKey || !item.conviction || shares <= 0}
                      onClick={() => onDeploy(item)}
                    >
                      {loadingKey === itemKey ? "Deploying..." : "Deploy trade"}
                    </Button>
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
