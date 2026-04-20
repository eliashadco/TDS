"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, History, LineChart, Radar, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { QuoteStatusBadge } from "@/components/market/QuoteStatusBadge";
import { cn } from "@/lib/utils";
import type { Mover, Quote } from "@/types/market";
import type { Metric, TradeMode } from "@/types/trade";
import type { StrategySnapshot } from "@/types/strategy";

export type StrategySelectionOption = {
  id: string;
  label: string;
  detail: string;
  setupLabel: string;
  strategyId: string | null;
  strategyVersionId: string | null;
  strategySnapshot: StrategySnapshot;
  metrics: Metric[];
  metricIds: string[];
  metricLabels: string[];
  setupTypes: string[];
  conditions: string[];
  chartPattern: string;
  strategyThesis?: string;
  previousConviction?: string | null;
  source: "saved" | "history";
};

type InstrumentPreviewDrawerProps = {
  open: boolean;
  mover: Mover | null;
  mode: TradeMode | null;
  quote: Quote | null;
  quoteLoading: boolean;
  selectedDirection: "LONG" | "SHORT";
  onDirectionChange: (direction: "LONG" | "SHORT") => void;
  strategyOptions: StrategySelectionOption[];
  selectedStrategyId: string;
  onStrategyChange: (strategyId: string) => void;
  scoring: boolean;
  scoringEnabled: boolean;
  scoringDisabledReason?: string | null;
  onScore: () => void;
  onClose: () => void;
  existingConvictionLabel?: string | null;
  feedQualityLabel: string;
  planTradeHref?: string | null;
};

function money(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "Awaiting price";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function pct(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Awaiting move";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatVolume(volume: number | null | undefined): string {
  if (typeof volume !== "number" || !Number.isFinite(volume) || volume <= 0) {
    return "Starter-universe estimate";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(volume);
}

function formatModeLabel(mode: TradeMode | null): string {
  if (!mode) {
    return "No lane selected";
  }

  if (mode === "daytrade") {
    return "Day Trade";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function buildTriggerLevel(price: number | null | undefined, direction: "LONG" | "SHORT", mode: TradeMode | null): string {
  if (!mode) {
    return "Select lane";
  }

  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return "Awaiting live trigger";
  }

  const offset = mode === "investment" ? 0.012 : mode === "swing" ? 0.006 : 0.003;
  const trigger = direction === "LONG" ? price * (1 + offset) : price * (1 - offset);
  return trigger.toFixed(2);
}

export default function InstrumentPreviewDrawer({
  open,
  mover,
  mode,
  quote,
  quoteLoading,
  selectedDirection,
  onDirectionChange,
  strategyOptions,
  selectedStrategyId,
  onStrategyChange,
  scoring,
  scoringEnabled,
  scoringDisabledReason,
  onScore,
  onClose,
  existingConvictionLabel,
  feedQualityLabel,
  planTradeHref,
}: InstrumentPreviewDrawerProps) {
  const selectedStrategy = strategyOptions.find((option) => option.id === selectedStrategyId) ?? strategyOptions[0] ?? null;
  const price = quote?.price ?? mover?.price ?? null;
  const changePct = quote?.changePct ?? mover?.changePct ?? null;
  const volume = quote?.volume ?? mover?.volumeValue ?? null;

  if (!mover) {
    return null;
  }

  return (
    <div className={cn("fixed inset-0 z-[70]", open ? "pointer-events-auto" : "pointer-events-none")}> 
      <button
        type="button"
        aria-label="Close instrument preview"
        className={cn("absolute inset-0 bg-slate-950/36 transition-opacity", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />

      <aside className={cn("absolute right-0 top-0 h-full w-full max-w-[520px] overflow-y-auto border-l border-white/70 bg-[linear-gradient(180deg,rgba(247,250,253,0.98),rgba(238,243,248,0.96))] p-6 shadow-[0_24px_70px_-28px_rgba(15,23,42,0.38)] transition-transform sm:p-7", open ? "translate-x-0" : "translate-x-full")}> 
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="meta-label">Instrument Preview</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-tds-text">{mover.ticker}</h2>
            <p className="mt-2 text-sm text-tds-dim">{mover.name}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close instrument preview"
            className="rounded-2xl border border-white/80 bg-white/88 p-2 text-tds-dim shadow-sm hover:bg-white hover:text-tds-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-tag neutral">{formatModeLabel(mode)}</span>
          <span className="inline-tag neutral">{feedQualityLabel}</span>
          {mover.sourceLabel ? <span className="inline-tag neutral">{mover.sourceLabel}</span> : null}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="trade-review-card trade-compact-card p-4">
            <div className="flex items-center gap-2 text-tds-dim">
              <LineChart className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">Recent price</p>
            </div>
            <p className="mt-3 font-mono text-xl text-tds-text">{quoteLoading ? "Loading..." : money(price)}</p>
            <p className="mt-2 text-xs text-tds-dim">{quoteLoading ? "Refreshing price context" : pct(changePct)}</p>
            <QuoteStatusBadge
              status={quoteLoading ? null : quote?.dataStatus ?? (price != null && price > 0 ? "fallback" : null)}
              provider={quote?.provider ?? null}
              className="mt-2"
            />
          </div>

          <div className="trade-review-card trade-compact-card p-4">
            <div className="flex items-center gap-2 text-tds-dim">
              <Radar className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">Trigger level</p>
            </div>
            <p className="mt-3 font-mono text-xl text-tds-text">{buildTriggerLevel(price, selectedDirection, mode)}</p>
            <p className="mt-2 text-xs text-tds-dim">{selectedDirection === "LONG" ? "Break above for confirmation" : "Break below for confirmation"}</p>
          </div>

          <div className="trade-review-card trade-compact-card p-4">
            <div className="flex items-center gap-2 text-tds-dim">
              <History className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">Conviction state</p>
            </div>
            <p className="mt-3 font-mono text-xl text-tds-text">{existingConvictionLabel ?? "Pending score"}</p>
            <p className="mt-2 text-xs text-tds-dim">Volume context {formatVolume(volume)}</p>
          </div>
        </div>

        <div className="trade-review-card mt-6 p-5">
          <p className="meta-label">Thesis Summary</p>
          <p className="mt-3 text-sm leading-7 text-tds-text">{mover.reason}</p>
        </div>

        <div className="trade-review-card mt-6 p-5">
          <p className="meta-label">Direction</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onDirectionChange("LONG")}
              className={selectedDirection === "LONG" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}
            >
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Long score
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onDirectionChange("SHORT")}
              className={selectedDirection === "SHORT" ? "border-rose-200 bg-rose-50 text-rose-700" : ""}
            >
              <ArrowDownLeft className="mr-2 h-4 w-4" />
              Short score
            </Button>
          </div>
        </div>

        <div className="trade-review-card mt-6 p-5">
          <p className="meta-label">Strategy Selection</p>
          <p className="mt-3 text-sm leading-6 text-tds-dim">
            {scoringEnabled
              ? "Choose the metric stack that should score this instrument. The general strategy uses your current custom indicators. Historical strategies reuse metric mixes from previous trades in this ticker."
              : scoringDisabledReason ?? "Choose a lane configuration and enable a strategy to score from MarketWatch."}
          </p>

          <label htmlFor="strategy-select" className="mt-5 block text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim">Score with strategy</label>
          <select
            id="strategy-select"
            value={selectedStrategyId}
            onChange={(event) => onStrategyChange(event.target.value)}
            disabled={!scoringEnabled || strategyOptions.length === 0}
            className="mt-2 h-11 w-full rounded-2xl border border-white/80 bg-white/88 px-4 text-sm text-tds-text shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_24px_-18px_rgba(15,23,42,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tds-focus focus-visible:ring-offset-2 focus-visible:ring-offset-tds-bg"
          >
            {strategyOptions.length === 0 ? <option value="">No strategies available</option> : null}
            {strategyOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>

          {selectedStrategy ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm leading-6 text-tds-text">{selectedStrategy.detail}</p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-tag neutral">{selectedStrategy.source === "history" ? "Historical snapshot" : "Saved strategy"}</span>
                <span className="inline-tag neutral">{selectedStrategy.setupLabel}</span>
                <span className="inline-tag neutral">{selectedStrategy.metricIds.length} checks</span>
              </div>
              {selectedStrategy.metricLabels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedStrategy.metricLabels.slice(0, 6).map((label) => (
                    <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-tds-dim">{label}</span>
                  ))}
                  {selectedStrategy.metricLabels.length > 6 ? <span className="inline-tag neutral">+{selectedStrategy.metricLabels.length - 6} more</span> : null}
                </div>
              ) : null}
              {selectedStrategy.strategyThesis ? <p className="text-sm leading-6 text-tds-dim">Historical anchor: {selectedStrategy.strategyThesis}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {planTradeHref ? (
            <Link href={planTradeHref} className={buttonVariants({ variant: "default" })} onClick={onClose}>
              Plan Trade
            </Link>
          ) : (
            <Button type="button" onClick={onScore} disabled={scoring || !selectedStrategy || !scoringEnabled}>
              {scoring ? "Scoring strategy..." : scoringEnabled ? "Score selected strategy" : "Scoring unavailable"}
            </Button>
          )}
          {planTradeHref ? (
            <Button type="button" variant="secondary" onClick={onScore} disabled={scoring || !selectedStrategy || !scoringEnabled}>
              {scoring ? "Re-scoring..." : "Re-score strategy"}
            </Button>
          ) : null}
          <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">
            {planTradeHref ? "Qualification passed. Carry this setup into Trade Studio." : scoringEnabled ? "Result will be moved into the custom watchlist workbench" : scoringDisabledReason ?? "Choose a lane configuration to unlock MarketWatch scoring."}
          </p>
        </div>
      </aside>
    </div>
  );
}
