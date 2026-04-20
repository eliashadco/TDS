"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculatePosition } from "@/lib/trading/scoring";
import type { Quote } from "@/types/market";
import type { ConvictionTier, Position, TradeThesis } from "@/types/trade";
import { useLearnMode } from "@/components/learn/LearnModeContext";

type SizingState = {
  quote: Quote | null;
  entryPrice: number | null;
  stopLoss: number | null;
  position: Position | null;
};

type SizingStepProps = {
  thesis: TradeThesis;
  equity: number;
  conviction: ConvictionTier;
  value: SizingState;
  onChange: (state: SizingState) => void;
  onBack: () => void;
  onNext: () => void;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildDeploymentPosition(basePosition: Position, starterShares: number): Position {
  const tranche1 = clamp(Math.round(starterShares), basePosition.tranche1, basePosition.shares);

  return {
    ...basePosition,
    tranche1,
    tranche2: Math.max(basePosition.shares - tranche1, 0),
  };
}

function normalizePriceDraft(rawValue: string): string {
  const sanitizedValue = rawValue.replace(/[^\d.]/g, "");
  const firstDecimalIndex = sanitizedValue.indexOf(".");

  if (firstDecimalIndex === -1) {
    return sanitizedValue;
  }

  return `${sanitizedValue.slice(0, firstDecimalIndex + 1)}${sanitizedValue.slice(firstDecimalIndex + 1).replace(/\./g, "")}`;
}

function parsePriceDraft(rawValue: string): number | null {
  const normalizedValue = normalizePriceDraft(rawValue);

  if (!normalizedValue || normalizedValue === "." || normalizedValue.endsWith(".")) {
    return null;
  }

  const numericValue = Number(normalizedValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function shouldSyncPriceDraft(draftValue: string, numericValue: number | null): boolean {
  if (!draftValue) {
    return numericValue !== null;
  }

  return parsePriceDraft(draftValue) !== numericValue;
}

export default function SizingStep({ thesis, equity, conviction, value, onChange, onBack, onNext }: SizingStepProps) {
  const { learnMode } = useLearnMode();
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [starterShares, setStarterShares] = useState<number | null>(null);
  const [entryDraft, setEntryDraft] = useState(value.entryPrice?.toString() ?? "");
  const [stopLossDraft, setStopLossDraft] = useState(value.stopLoss?.toString() ?? "");

  async function loadQuote() {
    setLoadingQuote(true);
    setPriceError(null);
    try {
      const response = await fetch(`/api/market/quote?ticker=${encodeURIComponent(thesis.ticker)}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("quote unavailable");
      }
      const quote = (await response.json()) as Quote;
      onChange({
        ...value,
        quote,
        entryPrice: value.entryPrice ?? quote.price,
      });
    } catch {
      setPriceError("Unable to fetch live quote. You can still enter entry and stop manually.");
    } finally {
      setLoadingQuote(false);
    }
  }

  const basePosition = useMemo(() => {
    if (value.entryPrice == null || value.stopLoss == null) {
      return null;
    }
    return calculatePosition(equity, conviction, value.entryPrice, value.stopLoss, thesis.direction);
  }, [conviction, equity, thesis.direction, value.entryPrice, value.stopLoss]);

  useEffect(() => {
    if (!basePosition) {
      setStarterShares(null);
      return;
    }

    setStarterShares((currentStarterShares) => {
      if (currentStarterShares == null) {
        return basePosition.tranche1;
      }

      return clamp(currentStarterShares, basePosition.tranche1, basePosition.shares);
    });
  }, [basePosition]);

  const position = useMemo(() => {
    if (!basePosition || starterShares == null) {
      return null;
    }

    return buildDeploymentPosition(basePosition, starterShares);
  }, [basePosition, starterShares]);

  useEffect(() => {
    onChange({
      quote: value.quote,
      entryPrice: value.entryPrice,
      stopLoss: value.stopLoss,
      position,
    });
  }, [onChange, position, value.entryPrice, value.quote, value.stopLoss]);

  useEffect(() => {
    const nextEntryDraft = value.entryPrice?.toString() ?? "";
    if (shouldSyncPriceDraft(entryDraft, value.entryPrice) && nextEntryDraft !== entryDraft) {
      setEntryDraft(nextEntryDraft);
    }
  }, [entryDraft, value.entryPrice]);

  useEffect(() => {
    const nextStopLossDraft = value.stopLoss?.toString() ?? "";
    if (shouldSyncPriceDraft(stopLossDraft, value.stopLoss) && nextStopLossDraft !== stopLossDraft) {
      setStopLossDraft(nextStopLossDraft);
    }
  }, [stopLossDraft, value.stopLoss]);

  useEffect(() => {
    if (thesis.ticker) {
      void loadQuote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thesis.ticker]);

  const lockedRisk = equity * conviction.risk;

  return (
    <div className="space-y-5">
      <div className="trade-step-hero trade-sizing-hero">
        <div className="trade-step-hero-copy">
        <p className="meta-label">Step 3</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-tds-text">Position sizing</h2>
          <p>Use the live quote, lock the floor-limited size, and confirm the exact entry risk before deployment review.</p>
        </div>
        <span className="trade-summary-pill">{thesis.ticker}</span>
      </div>

      <div className="trade-sizing-desk">
        <div className="trade-sizing-main-stack">
          <div className="trade-review-card trade-compact-card trade-sizing-input-card">
            <div className="trade-sizing-toolbar">
              <div>
                <p className="meta-label">Execution Inputs</p>
                <p className="trade-thesis-summary-empty">Entry and stop drive the mechanical floor and the staged position size.</p>
              </div>
              <Button type="button" size="sm" variant="secondary" className="secondary-button" disabled={loadingQuote} onClick={() => void loadQuote()}>
                Refresh quote
              </Button>
            </div>

            <div className="trade-sizing-input-grid">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Entry Price</p>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={entryDraft}
                  onChange={(event) => {
                    const nextDraft = normalizePriceDraft(event.target.value);
                    setEntryDraft(nextDraft);
                    onChange({
                      ...value,
                      entryPrice: parsePriceDraft(nextDraft),
                    });
                  }}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Stop Loss</p>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={stopLossDraft}
                  onChange={(event) => {
                    const nextDraft = normalizePriceDraft(event.target.value);
                    setStopLossDraft(nextDraft);
                    onChange({
                      ...value,
                      stopLoss: parsePriceDraft(nextDraft),
                    });
                  }}
                  placeholder="0.00"
                />
              </div>
            </div>

            {position ? (
              <div className="trade-sizing-position-shell">
                <div className="trade-sizing-position-grid">
                  <article>
                    <span>Shares</span>
                    <strong>{position.shares}</strong>
                  </article>
                  <article>
                    <span>Position Value</span>
                    <strong>{formatCurrency(position.value)}</strong>
                  </article>
                  <article>
                    <span>1R / Share</span>
                    <strong>{formatCurrency(position.rPerShare)}</strong>
                  </article>
                  <article>
                    <span>Total Risk</span>
                    <strong>{formatCurrency(position.risk)}</strong>
                  </article>
                </div>

                {basePosition ? (
                  <div className="sizing-slider-shell mt-5">
                    <div className="sizing-slider-header">
                      <div>
                        <p className="meta-label">Starter deployment</p>
                        <p className="sizing-slider-caption">Floor-limited between the mechanical entry floor and the full planned size.</p>
                      </div>
                      <span className="inline-tag neutral">{position.tranche1}/{basePosition.shares} shares live</span>
                    </div>

                    <input
                      type="range"
                      min={basePosition.tranche1}
                      max={basePosition.shares}
                      step={1}
                      value={starterShares ?? basePosition.tranche1}
                      onChange={(event) => setStarterShares(Number(event.target.value))}
                      className="trade-range-input"
                      aria-label="Starter deployment slider"
                    />

                    <div className="sizing-slider-scale">
                      <span>Mechanical floor {basePosition.tranche1}</span>
                      <span>Full size {basePosition.shares}</span>
                    </div>

                    <div className="grid gap-2 text-sm text-tds-dim md:grid-cols-2">
                      <p>
                        Starter value: <span className="font-mono text-tds-text">{formatCurrency(position.tranche1 * (value.entryPrice ?? 0))}</span>
                      </p>
                      <p>
                        Add-on reserve: <span className="font-mono text-tds-text">{formatCurrency(position.tranche2 * (value.entryPrice ?? 0))}</span>
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-tds-dim">Enter valid entry and stop values to calculate position.</p>
            )}

            {priceError ? <p className="text-sm text-tds-red">{priceError}</p> : null}
          </div>
        </div>

        <aside className="trade-sizing-side-rail">
          <article className="trade-review-card trade-compact-card">
            <p className="text-sm text-tds-dim">Market Price</p>
            <p className="font-mono text-3xl text-tds-text">{value.quote ? formatCurrency(value.quote.price) : "--"}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-tds-dim">
              {value.quote ? `${value.quote.changePct >= 0 ? "+" : ""}${value.quote.changePct.toFixed(2)}%` : "Awaiting quote"}
            </p>
          </article>

          <article className="trade-review-card trade-compact-card">
            <p className="text-sm text-tds-dim">Conviction Tier</p>
            <p className="font-mono text-lg text-tds-text">
              {conviction.tier} · {(conviction.risk * 100).toFixed(0)}% = {formatCurrency(lockedRisk)}
            </p>
            <p className="mt-3 rounded-[18px] border border-tds-amber/20 bg-tds-amber/10 p-3 text-xs text-tds-text">
              Mechanical risk is locked to the {conviction.tier} tier. Starter size cannot drop below the calculated floor, but you can pull more of tranche two forward when execution quality is high.
            </p>
          </article>

          {learnMode ? (
            <div className="trade-review-card trade-compact-card text-xs text-tds-dim">
              <p className="font-mono text-sm text-tds-text">Sizing Education</p>
              <p className="mt-2">
                Conviction tiers map to locked risk budgets: STD 2%, HIGH 3%, MAX 4%. Locking prevents undersizing that breaks your evidence-to-risk framework.
              </p>
              <p className="mt-2">
                1R is the distance from entry to stop. A 2R target equals two times that distance; a 4R target equals four times that distance. This keeps reward targets consistent across setups.
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onBack}>
          ← Back
        </Button>
        <Button type="button" className="primary-button" onClick={onNext} disabled={!position}>
          Next →
        </Button>
      </div>
    </div>
  );
}