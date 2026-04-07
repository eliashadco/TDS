"use client";

import { useEffect, useMemo, useState } from "react";
import { QuoteStatusBadge } from "@/components/market/QuoteStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCandleRange, getDefaultCandleTimeframe } from "@/lib/market/candle-range";
import { calculatePosition } from "@/lib/trading/scoring";
import type { Candle, CandleTimeframe, Quote } from "@/types/market";
import type { ConvictionTier, Position, TradeMode, TradeThesis } from "@/types/trade";
import PriceChart from "@/components/chart/PriceChart";
import { useLearnMode } from "@/components/learn/LearnModeContext";

type SizingState = {
  quote: Quote | null;
  entryPrice: number | null;
  stopLoss: number | null;
  position: Position | null;
};

type SizingStepProps = {
  thesis: TradeThesis;
  mode: TradeMode;
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

export default function SizingStep({ thesis, mode, equity, conviction, value, onChange, onBack, onNext }: SizingStepProps) {
  const { learnMode } = useLearnMode();
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<CandleTimeframe>(() => getDefaultCandleTimeframe(mode));

  useEffect(() => {
    setTimeframe(getDefaultCandleTimeframe(mode));
  }, [mode]);

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

  const position = useMemo(() => {
    if (value.entryPrice == null || value.stopLoss == null) {
      return null;
    }
    return calculatePosition(equity, conviction, value.entryPrice, value.stopLoss, thesis.direction);
  }, [conviction, equity, thesis.direction, value.entryPrice, value.stopLoss]);

  useEffect(() => {
    onChange({ ...value, position });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  useEffect(() => {
    if (thesis.ticker) {
      void loadQuote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thesis.ticker]);

  useEffect(() => {
    async function loadCandles() {
      const range = getCandleRange(mode, timeframe);
      const params = new URLSearchParams({
        ticker: thesis.ticker,
        from: range.from,
        to: range.to,
        timeframe: range.timeframe,
      });

      try {
        const response = await fetch(`/api/market/candles?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as Candle[];
        setCandles(Array.isArray(data) ? data : []);
      } catch {
        setCandles([]);
      }
    }

    if (thesis.ticker) {
      void loadCandles();
    }
  }, [mode, thesis.ticker, timeframe]);

  const lockedRisk = equity * conviction.risk;

  return (
    <div className="space-y-6">
      <div>
        <p className="fin-kicker">Step 3</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-tds-text">Position sizing</h2>
      </div>

      <div className="fin-card p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm text-tds-dim">Market Price</p>
          <Button type="button" size="sm" variant="secondary" disabled={loadingQuote} onClick={() => void loadQuote()}>
            Refresh
          </Button>
        </div>
        <p className="font-mono text-3xl text-tds-text">{value.quote ? formatCurrency(value.quote.price) : "--"}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-tds-dim">
          {value.quote ? `${value.quote.changePct >= 0 ? "+" : ""}${value.quote.changePct.toFixed(2)}%` : "Awaiting quote"}
        </p>
        <QuoteStatusBadge status={value.quote?.dataStatus ?? null} provider={value.quote?.provider ?? null} className="mt-3" />
      </div>

      {learnMode ? (
        <div className="fin-card p-5 text-xs text-tds-dim">
          <p className="font-mono text-sm text-tds-text">Sizing Education</p>
          <p className="mt-2">
            Conviction tiers map to locked risk budgets: STD 2%, HIGH 3%, MAX 4%. Locking prevents undersizing that breaks your evidence-to-risk framework.
          </p>
          <p className="mt-2">
            1R is the distance from entry to stop. A 2R target equals two times that distance; a 4R target equals four times that distance. This keeps reward targets consistent across setups.
          </p>
        </div>
      ) : null}

      <div className="fin-card p-5">
        <p className="text-sm text-tds-dim">Conviction Tier</p>
        <p className="font-mono text-lg text-tds-text">
          {conviction.tier} · {(conviction.risk * 100).toFixed(0)}% = {formatCurrency(lockedRisk)}
        </p>
        <p className="mt-3 rounded-[18px] border border-tds-amber/20 bg-tds-amber/10 p-3 text-xs text-tds-text">
          Sizing locked to {conviction.tier} tier. Cannot size below {(conviction.risk * 100).toFixed(0)}%.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Entry Price</p>
          <Input
            type="number"
            value={value.entryPrice ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                entryPrice: event.target.value ? Number(event.target.value) : null,
              })
            }
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Stop Loss</p>
          <Input
            type="number"
            value={value.stopLoss ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                stopLoss: event.target.value ? Number(event.target.value) : null,
              })
            }
            placeholder="0.00"
          />
        </div>
      </div>

      {position ? (
        <div className="fin-card p-5">
          <p className="mb-2 font-mono text-sm text-tds-text">Calculated Position</p>
          <div className="grid gap-2 text-sm text-tds-dim md:grid-cols-2">
            <p>Shares: <span className="font-mono text-tds-text">{position.shares}</span></p>
            <p>Position Value: <span className="font-mono text-tds-text">{formatCurrency(position.value)}</span></p>
            <p>1R / Share: <span className="font-mono text-tds-text">{formatCurrency(position.rPerShare)}</span></p>
            <p>Total Risk: <span className="font-mono text-tds-text">{formatCurrency(position.risk)}</span></p>
          </div>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-tds-dim">
            Tranche split: T1 {position.tranche1} shares (60%) + T2 {position.tranche2} shares (40%)
          </p>
        </div>
      ) : (
        <p className="text-sm text-tds-dim">Enter valid entry and stop values to calculate position.</p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Recent Price History</p>
          <div className="flex flex-wrap gap-2">
            {(["hour", "day", "week"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTimeframe(value)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  timeframe === value ? "border-blue-200 bg-blue-50 text-tds-blue" : "border-white/80 bg-white text-tds-dim hover:text-tds-text"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <PriceChart
          candles={candles}
          direction={thesis.direction}
          entryPrice={value.entryPrice ?? undefined}
          stopLoss={value.stopLoss ?? undefined}
          r2Target={position?.r2Target}
          r4Target={position?.r4Target}
          timeframe={timeframe}
        />
      </div>

      {priceError ? <p className="text-sm text-tds-red">{priceError}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button type="button" onClick={onNext} disabled={!position}>
          Next →
        </Button>
      </div>
    </div>
  );
}