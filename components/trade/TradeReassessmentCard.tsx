"use client";

import { useEffect, useMemo, useState } from "react";
import AIProviderBadge from "@/components/ai/AIProviderBadge";
import { createClient } from "@/lib/supabase/client";
import { extractAIResponseMeta } from "@/lib/ai/response";
import AssessmentMatrix from "@/components/trade/AssessmentMatrix";
import { Button } from "@/components/ui/button";
import { getConviction } from "@/lib/trading/scoring";
import { resolveMetricAssessmentDescription } from "@/lib/trading/user-metrics";
import type { Database, Json } from "@/types/database";
import type { AIResponseMeta } from "@/lib/ai/response";
import type { SavedStrategy } from "@/types/strategy";

type TradeRow = Database["public"]["Tables"]["trades"]["Row"];

type TradeReassessmentCardProps = {
  trade: TradeRow;
  availableStrategies: SavedStrategy[];
  onTradeUpdated: (trade: TradeRow) => void;
};

function asRecord(input: Json): Record<string, Json> {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, Json>;
  }
  return {};
}

function asNumberMap(input: Json): Record<string, 0 | 1> {
  const map = asRecord(input);
  return Object.keys(map).reduce(
    (acc, key) => {
      const value = map[key];
      if (value === 0 || value === 1) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, 0 | 1>,
  );
}

function asStringMap(input: Json): Record<string, string> {
  const map = asRecord(input);
  return Object.keys(map).reduce(
    (acc, key) => {
      const value = map[key];
      if (typeof value === "string") {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );
}

function formatModeLabel(mode: SavedStrategy["mode"]): string {
  if (mode === "daytrade") {
    return "Day Trade";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export default function TradeReassessmentCard({ trade, availableStrategies, onTradeUpdated }: TradeReassessmentCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(trade.strategy_id ?? availableStrategies[0]?.id ?? "");
  const [scores, setScores] = useState<Record<string, 0 | 1>>(asNumberMap(trade.scores));
  const [notes, setNotes] = useState<Record<string, string>>(asStringMap(trade.notes));
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reassessmentMeta, setReassessmentMeta] = useState<AIResponseMeta | null>(null);

  const selectedStrategy = availableStrategies.find((strategy) => strategy.id === selectedStrategyId) ?? null;
  const metrics = selectedStrategy?.metrics.filter((metric) => metric.enabled) ?? [];

  useEffect(() => {
    if (!selectedStrategy) {
      return;
    }

    if (selectedStrategy.id === trade.strategy_id) {
      setScores(asNumberMap(trade.scores));
      setNotes(asStringMap(trade.notes));
      return;
    }

    setScores({});
    setNotes({});
  }, [selectedStrategy, trade.notes, trade.scores, trade.strategy_id]);

  if (!trade.confirmed || trade.closed || availableStrategies.length === 0 || !selectedStrategy) {
    return null;
  }

  const matrixItems = metrics.map((metric) => ({
    id: metric.id,
    name: metric.name,
    description: resolveMetricAssessmentDescription(metric, trade.direction),
    type: metric.type,
    note: notes[metric.id],
    value: scores[metric.id] ?? null,
  }));

  const fMetrics = metrics.filter((metric) => metric.type === "fundamental");
  const tMetrics = metrics.filter((metric) => metric.type === "technical");
  const fScore = fMetrics.reduce((sum, metric) => sum + (scores[metric.id] ?? 0), 0);
  const tScore = tMetrics.reduce((sum, metric) => sum + (scores[metric.id] ?? 0), 0);
  const conviction = getConviction(fScore, fMetrics.length, tScore, tMetrics.length);
  const modeSwitch = selectedStrategy.mode !== trade.mode;

  async function runReassessment() {
    if (!selectedStrategy || metrics.length === 0) {
      setError("This strategy has no enabled checks to reassess.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    setReassessmentMeta(null);

    try {
      const response = await fetch("/api/ai/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: trade.ticker,
          direction: trade.direction,
          thesis: trade.thesis,
          setups: selectedStrategy.structure.setupTypes,
          conditions: selectedStrategy.structure.conditions,
          chartPattern: selectedStrategy.structure.chartPattern,
          asset: trade.asset_class,
          mode: selectedStrategy.mode,
          strategyName: selectedStrategy.name,
          strategyInstruction: selectedStrategy.aiInstruction,
          metrics: metrics.map((metric) => ({
            id: metric.id,
            name: metric.name,
            desc: resolveMetricAssessmentDescription(metric, trade.direction),
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("reassessment_failed");
      }

      setReassessmentMeta(extractAIResponseMeta(response));

      const data = (await response.json()) as Record<string, { v: "PASS" | "FAIL"; r: string }>;
      const nextScores: Record<string, 0 | 1> = {};
      const nextNotes: Record<string, string> = {};

      for (const metric of metrics) {
        const result = data[metric.id];
        if (!result) {
          continue;
        }

        nextScores[metric.id] = result.v === "PASS" ? 1 : 0;
        nextNotes[metric.id] = result.r;
      }

      setScores(nextScores);
      setNotes(nextNotes);
      setMessage(`${selectedStrategy.name} reassessment loaded. Review the matrix, then apply it to the trade if you want to switch frames.`);
    } catch {
      setError("Unable to run the reassessment right now. You can still set the matrix manually.");
    } finally {
      setLoading(false);
    }
  }

  async function applyReassessment() {
    if (!selectedStrategy || metrics.length === 0) {
      return;
    }

    setApplying(true);
    setError(null);
    setMessage(null);

    try {
      const patch: Database["public"]["Tables"]["trades"]["Update"] = {
        mode: selectedStrategy.mode,
        strategy_id: selectedStrategy.id,
        strategy_version_id: selectedStrategy.activeVersionId,
        strategy_name: selectedStrategy.name,
        strategy_snapshot: selectedStrategy.snapshot as unknown as Json,
        setup_types: selectedStrategy.structure.setupTypes,
        conditions: selectedStrategy.structure.conditions,
        chart_pattern: selectedStrategy.structure.chartPattern || "None",
        invalidation: selectedStrategy.structure.invalidationStyle || trade.invalidation,
        scores,
        notes,
        f_score: fScore,
        t_score: tScore,
        f_total: fMetrics.length,
        t_total: tMetrics.length,
        conviction: conviction?.tier ?? trade.conviction,
        updated_at: new Date().toISOString(),
      };

      const { data, error: updateError } = await supabase
        .from("trades")
        .update(patch)
        .eq("id", trade.id)
        .select("*")
        .single();

      if (updateError || !data) {
        throw updateError ?? new Error("trade_update_failed");
      }

      onTradeUpdated(data);
      setMessage(
        modeSwitch
          ? `${trade.ticker} was reassessed and switched into ${formatModeLabel(selectedStrategy.mode)} using ${selectedStrategy.name}.`
          : `${trade.ticker} was reassessed against ${selectedStrategy.name} and the trade snapshot was updated.`,
      );
    } catch {
      setError("Failed to apply the reassessment to this trade.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="fin-panel p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="fin-kicker">Reassessment Studio</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Re-score the live trade with another strategy</h2>
          <p className="mt-3 text-sm leading-6 text-tds-dim">Use this when the trade has no saved assessment, when the current lane is stale, or when you want to promote the idea into a new mode like swing or investment.</p>
        </div>
        <div className="flex items-center gap-2">
          {reassessmentMeta ? <AIProviderBadge meta={reassessmentMeta} /> : null}
          {modeSwitch ? <span className="fin-chip">Switching to {formatModeLabel(selectedStrategy.mode)}</span> : <span className="fin-chip">{selectedStrategy.name}</span>}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
        <div>
          <label htmlFor="trade-reassessment-strategy" className="text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim">
            Reassess with strategy
          </label>
          <select
            id="trade-reassessment-strategy"
            value={selectedStrategyId}
            onChange={(event) => setSelectedStrategyId(event.target.value)}
            className="mt-2 h-11 w-full rounded-2xl border border-white/80 bg-white px-4 text-sm text-tds-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tds-focus"
          >
            {availableStrategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.name} • {formatModeLabel(strategy.mode)}
              </option>
            ))}
          </select>
        </div>

        <Button type="button" variant="secondary" disabled={loading} onClick={() => void runReassessment()}>
          {loading ? "Reassessing..." : "Run reassessment"}
        </Button>

        <Button type="button" disabled={applying || metrics.length === 0} onClick={() => void applyReassessment()}>
          {applying ? "Applying..." : modeSwitch ? "Apply and switch trade" : "Apply to trade"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="fin-card p-4">
          <p className="fin-kicker">Mode</p>
          <p className="mt-2 text-sm text-tds-text">{formatModeLabel(selectedStrategy.mode)}</p>
        </div>
        <div className="fin-card p-4">
          <p className="fin-kicker">Enabled checks</p>
          <p className="mt-2 text-sm text-tds-text">{metrics.length}</p>
        </div>
        <div className="fin-card p-4">
          <p className="fin-kicker">Current gate</p>
          <p className="mt-2 text-sm text-tds-text">F {fScore}/{fMetrics.length || 0} · T {tScore}/{tMetrics.length || 0} · {conviction?.tier ?? "No conviction"}</p>
        </div>
      </div>

      <div className="mt-5">
        <AssessmentMatrix
          metrics={matrixItems}
          mode={selectedStrategy.mode}
          direction={trade.direction}
          editable
          emptyMessage="Run the reassessment first or score the strategy manually."
          noteLabel="Reassessment rationale"
          onScoreChange={(metricId, value) => setScores((previous) => ({ ...previous, [metricId]: value }))}
        />
      </div>

      {message ? <p className="mt-4 text-sm text-tds-dim">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-tds-red">{error}</p> : null}
    </section>
  );
}