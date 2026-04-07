"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { formatMarketDataRefreshTime, getStoredMarketDataRefreshToken, subscribeToMarketDataRefresh } from "@/lib/market/refresh";
import { resolveMetricAssessmentDescription } from "@/lib/trading/user-metrics";
import type { Metric, TradeMode } from "@/types/trade";
import type { Mover } from "@/types/market";

type SmartWatchlistCardProps = {
  mode: TradeMode;
  strategyLabel: string;
  metrics: Metric[];
};

type SmartMover = {
  ticker: string;
  name: string;
  direction: "LONG" | "SHORT";
  changePct: number;
  price: number;
  score: number;
  verdict: "READY" | "QUEUE" | "WATCH";
  note: string;
  sourceLabel?: string;
};

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function normalizeMover(input: unknown): Mover {
  const value = asRecord(input);

  return {
    ticker: String(value.ticker ?? "").toUpperCase(),
    name: String(value.name ?? "Unknown"),
    price: Number(value.price ?? 0),
    change: Number(value.change ?? 0),
    changePct: Number(value.changePct ?? value.change_pct ?? 0),
    volume: String(value.volume ?? "-"),
    volumeValue: Number(value.volumeValue ?? value.volume_value ?? 0),
    reason: String(value.reason ?? "No catalyst available."),
    sourceLabel: typeof value.sourceLabel === "string" ? value.sourceLabel : undefined,
    activityScore: Number(value.activityScore ?? value.activity_score ?? 0),
  };
}

function verdictForScore(score: number): SmartMover["verdict"] {
  if (score >= 85) {
    return "READY";
  }
  if (score >= 65) {
    return "QUEUE";
  }
  return "WATCH";
}

function fallbackScore(mode: TradeMode, mover: Mover): number {
  const directionalBias = Math.abs(mover.changePct);
  const liquidityBias = Math.min(30, Math.log10(Math.max(mover.volumeValue, 1)) * 8);
  const priceBias = mode === "daytrade" || mode === "scalp" ? Math.min(25, directionalBias * 3.5) : Math.min(20, directionalBias * 2.2);

  return Math.max(40, Math.min(92, Math.round(35 + liquidityBias + priceBias)));
}

function formatModeLabel(mode: TradeMode): string {
  if (mode === "daytrade") {
    return "Day Trade";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export default function SmartWatchlistCard({ mode, strategyLabel, metrics }: SmartWatchlistCardProps) {
  const [items, setItems] = useState<SmartMover[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [lastRefreshToken, setLastRefreshToken] = useState<number | null>(null);

  useEffect(() => {
    setLastRefreshToken(getStoredMarketDataRefreshToken());
    return subscribeToMarketDataRefresh((token) => {
      setRefreshToken(token);
      setLastRefreshToken(token);
    });
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadSmartWatchlist() {
      setLoading(true);
      setStatus(null);

      try {
        const feedResponse = await fetch("/api/market/premarket?limit=8", { cache: "no-store" });
        const feedPayload = (await feedResponse.json().catch(() => ({}))) as { movers?: unknown[]; message?: string; error?: string };

        if (!feedResponse.ok) {
          throw new Error(feedPayload.error ?? "Unable to load market movers.");
        }

        const candidates = (Array.isArray(feedPayload.movers) ? feedPayload.movers : []).map(normalizeMover).filter((mover) => mover.ticker).slice(0, 8);
        if (candidates.length === 0) {
          if (isActive) {
            setItems([]);
            setStatus(feedPayload.message ?? "No movers available for the smart watchlist right now.");
          }
          return;
        }

        const scored = await Promise.all(
          candidates.map(async (mover) => {
            const direction = mover.changePct >= 0 ? "LONG" : "SHORT";

            try {
              const response = await fetch("/api/ai/assess", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ticker: mover.ticker,
                  direction,
                  thesis: mover.reason,
                  setups: [`${formatModeLabel(mode)} strategy scan`],
                  asset: "Equity",
                  mode,
                  metrics: metrics.map((metric) => ({
                    id: metric.id,
                    name: metric.name,
                    desc: resolveMetricAssessmentDescription(metric, direction),
                  })),
                }),
              });

              if (!response.ok) {
                throw new Error("AI scoring unavailable");
              }

              const payload = (await response.json()) as Record<string, { v: "PASS" | "FAIL"; r: string }>;
              const passed = metrics.reduce((count, metric) => count + (payload[metric.id]?.v === "PASS" ? 1 : 0), 0);
              const score = metrics.length > 0 ? Math.round((passed / metrics.length) * 100) : 0;

              return {
                ticker: mover.ticker,
                name: mover.name,
                direction,
                changePct: mover.changePct,
                price: mover.price,
                score,
                verdict: verdictForScore(score),
                note: payload[metrics[0]?.id ?? ""]?.r ?? mover.reason,
                sourceLabel: mover.sourceLabel,
              } satisfies SmartMover;
            } catch {
              const score = fallbackScore(mode, mover);

              return {
                ticker: mover.ticker,
                name: mover.name,
                direction,
                changePct: mover.changePct,
                price: mover.price,
                score,
                verdict: verdictForScore(score),
                note: `${formatModeLabel(mode)} fallback score from liquidity and momentum.`,
                sourceLabel: mover.sourceLabel,
              } satisfies SmartMover;
            }
          }),
        );

        if (!isActive) {
          return;
        }

        setItems(scored.sort((left, right) => right.score - left.score).slice(0, 5));
        setStatus(feedPayload.message ?? null);
      } catch (error) {
        if (isActive) {
          setItems([]);
          setStatus(error instanceof Error ? error.message : "Unable to build the smart watchlist right now.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadSmartWatchlist();

    return () => {
      isActive = false;
    };
  }, [metrics, mode, refreshToken]);

  return (
    <section className="fin-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="fin-kicker">Smart Watchlist</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Top 5 strategy-fit movers</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-tds-dim">Ranked using {strategyLabel}.</p>
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-tds-dim">Market Sync {formatMarketDataRefreshTime(lastRefreshToken)}</p>
        </div>
        <Link href="/portfolio-analytics?tab=marketwatch" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/80 bg-white px-4 text-sm font-semibold text-tds-text shadow-sm hover:bg-tds-wash">
          Open MarketWatch
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {loading ? <div className="fin-card mt-6 p-5 text-sm text-tds-dim">Scoring movers...</div> : null}
      {!loading && status ? <div className="mt-5 rounded-[22px] border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm text-tds-dim">{status}</div> : null}

      <div className="mt-6 space-y-3">
        {!loading && items.length === 0 ? <p className="text-sm leading-6 text-tds-dim">No candidates right now.</p> : null}
        {items.map((item) => (
          <div key={item.ticker} className="fin-card flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-base font-semibold text-tds-text">{item.ticker}</span>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${item.direction === "LONG" ? "bg-tds-green/10 text-tds-green" : "bg-tds-red/10 text-tds-red"}`}>{item.direction}</span>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${item.verdict === "READY" ? "bg-tds-green/10 text-tds-green" : item.verdict === "QUEUE" ? "bg-tds-blue/10 text-tds-blue" : "bg-tds-amber/10 text-tds-amber"}`}>{item.verdict}</span>
                {item.sourceLabel ? <span className="fin-chip">{item.sourceLabel}</span> : null}
              </div>
              <p className="mt-2 text-sm font-medium text-tds-text">{item.name}</p>
              <p className="mt-1 text-xs leading-5 text-tds-dim">{item.note}</p>
            </div>

            <div className="text-right">
              <p className="font-mono text-lg text-tds-text">{item.score}</p>
              <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Trade score</p>
              <p className={`mt-2 text-sm font-semibold ${item.changePct >= 0 ? "text-tds-green" : "text-tds-red"}`}>{item.changePct >= 0 ? "+" : ""}{item.changePct.toFixed(2)}%</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}