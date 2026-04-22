"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, Gamepad2, Loader2, RefreshCw, Shield, SkipForward } from "lucide-react";
import PriceChart from "@/components/chart/PriceChart";
import type { ReadyTradeView } from "@/components/dashboard/ReadyTradesCard";
import type { Candle } from "@/types/market";
import type { Metric } from "@/types/trade";

type BlindEvaluationCardProps = {
  activeStrategy: {
    id: string;
    name: string;
    description: string;
    versionNumber: number;
    metrics: Metric[];
  } | null;
  items: ReadyTradeView[];
};

type RoundAction = "approved" | "skipped";

type BlindSignal = {
  label: string;
  value: string;
};

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildExecutionHref(item: ReadyTradeView, strategyId: string): string {
  const params = new URLSearchParams({
    ticker: item.ticker,
    direction: item.direction,
    strategyId,
    thesis: item.thesisSummary,
  });

  return `/trade/new?${params.toString()}`;
}

function deriveBlindSignals(candles: Candle[], direction: "LONG" | "SHORT"): BlindSignal[] {
  if (candles.length < 8) {
    return [
      { label: "Trend", value: direction === "LONG" ? "Long bias" : "Short bias" },
      { label: "Structure", value: "Awaiting deeper read" },
      { label: "Volume", value: "Data building" },
    ];
  }

  const recent = candles.slice(-12);
  const prior = candles.slice(-24, -12);
  const firstRecent = recent[0];
  const lastRecent = recent[recent.length - 1];
  const avgRecentRange = recent.reduce((sum, candle) => sum + (candle.high - candle.low), 0) / recent.length;
  const avgPriorRange = prior.length > 0
    ? prior.reduce((sum, candle) => sum + (candle.high - candle.low), 0) / prior.length
    : avgRecentRange;
  const avgRecentVolume = recent.reduce((sum, candle) => sum + candle.volume, 0) / recent.length;
  const avgPriorVolume = prior.length > 0
    ? prior.reduce((sum, candle) => sum + candle.volume, 0) / prior.length
    : avgRecentVolume;
  const slope = ((lastRecent.close - firstRecent.close) / Math.max(firstRecent.close, 1)) * 100;
  const rangeRatio = avgRecentRange / Math.max(avgPriorRange, 0.0001);
  const volumeRatio = avgRecentVolume / Math.max(avgPriorVolume, 1);
  const higherLows = recent.slice(1).every((candle, index) => candle.low >= recent[index].low);
  const lowerHighs = recent.slice(1).every((candle, index) => candle.high <= recent[index].high);

  const trendValue =
    direction === "LONG"
      ? slope > 2
        ? "Uptrend in force"
        : slope > -1
          ? "Base-building"
          : "Countertrend pressure"
      : slope < -2
        ? "Downtrend in force"
        : slope < 1
          ? "Breakdown coil"
          : "Countertrend pressure";

  const structureValue = higherLows
    ? "Higher lows"
    : lowerHighs
      ? "Lower highs"
      : "Two-way range";

  const volumeValue = volumeRatio > 1.2 ? "Participation expanding" : volumeRatio < 0.85 ? "Participation thinning" : "Participation stable";
  const volatilityValue = rangeRatio < 0.9 ? "Compression" : rangeRatio > 1.15 ? "Expansion" : "Balanced range";

  return [
    { label: "Trend", value: trendValue },
    { label: "Structure", value: structureValue },
    { label: "Volume", value: volumeValue },
    { label: "Volatility", value: volatilityValue },
  ];
}

export default function BlindEvaluationCard({ activeStrategy, items }: BlindEvaluationCardProps) {
  const candidates = useMemo(
    () => activeStrategy ? items.filter((item) => item.verdict === "GO" && (item.strategyId ? item.strategyId === activeStrategy.id : item.strategyLabel === activeStrategy.name)) : [],
    [activeStrategy, items],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ reviewed: 0, approved: 0, skipped: 0 });
  const current = candidates[candidateIndex] ?? null;

  useEffect(() => {
    if (candidateIndex >= candidates.length) {
      setCandidateIndex(0);
    }
  }, [candidateIndex, candidates.length]);

  useEffect(() => {
    setRevealed(false);
  }, [candidateIndex]);

  useEffect(() => {
    if (!current) {
      setCandles([]);
      return;
    }

    const controller = new AbortController();
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 120);

    setLoading(true);
    fetch(
      `/api/market/candles?ticker=${encodeURIComponent(current.ticker)}&from=${formatDate(from)}&to=${formatDate(to)}&timeframe=day`,
      { signal: controller.signal },
    )
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        setCandles(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setCandles([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [current]);

  const signals = useMemo(() => (current ? deriveBlindSignals(candles, current.direction) : []), [candles, current]);
  const enabledMetrics = activeStrategy?.metrics.filter((metric) => metric.enabled) ?? [];
  const hardMetrics = enabledMetrics.filter((metric) => metric.isHard);

  function completeRound(action: RoundAction) {
    setStats((previous) => ({
      reviewed: previous.reviewed + 1,
      approved: previous.approved + (action === "approved" ? 1 : 0),
      skipped: previous.skipped + (action === "skipped" ? 1 : 0),
    }));

    if (action === "approved") {
      setRevealed(true);
      return;
    }

    setCandidateIndex((previous) => (candidates.length === 0 ? 0 : (previous + 1) % candidates.length));
  }

  if (candidates.length === 0 || !current) {
    return (
      <section className="surface-panel blind-eval-panel">
        <div className="blind-eval-header-shell">
          <div className="surface-header blind-eval-header">
            <div>
              <p className="meta-label">Evaluation Queue</p>
              <h3>No anonymous challenge queued</h3>
            </div>
            <div className="blind-eval-top-meta">
              <span className="blind-eval-counter">0 / 0</span>
              <span className="blind-eval-pill">Bias shield offline</span>
            </div>
          </div>
          <p className="blind-eval-lead">Blind rounds come online when a GO setup clears the assigned strategy and is ready for anonymous chart review.</p>
        </div>
        <div className="blind-eval-empty-grid">
          <article className="blind-eval-empty-card">
            <p className="blind-eval-panel-label">What activates a round</p>
            <p className="blind-eval-empty-copy">A GO-scored setup, tied to the current lane, enters here once it clears the workbench and is ready for anonymous chart review.</p>
          </article>
          <article className="blind-eval-empty-card">
            <p className="blind-eval-panel-label">Best next move</p>
            <p className="blind-eval-empty-copy">Score MarketWatch candidates or build a new thesis so the queue can present the next structure-first challenge.</p>
          </article>
        </div>
        <div className="blind-eval-empty-actions">
          <Link className="blind-eval-primary blind-eval-link" href="/portfolio-analytics?tab=marketwatch">
            Open workbench
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link className="blind-eval-secondary blind-eval-link-secondary" href="/trade/new">
            Start new thesis
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="surface-panel blind-eval-panel">
      <div className="blind-eval-header-shell">
        <div className="surface-header blind-eval-header">
          <div>
            <p className="meta-label">Evaluation Queue</p>
            <h3>Trade the setup, not the story</h3>
          </div>
          <div className="blind-eval-top-meta">
            <span className="blind-eval-counter">{candidateIndex + 1} / {candidates.length}</span>
            <span className="blind-eval-pill">Bias shield active</span>
          </div>
        </div>
        <p className="blind-eval-lead">Approve the structure only if the anonymous chart qualifies on its own. The ticker appears after conviction, not before.</p>
      </div>

      <div className="blind-eval-grid">
        <div className="blind-eval-chart-panel">
          <div className="blind-eval-chart-head">
            <div>
              <p className="blind-eval-kicker">Anonymous challenge {candidateIndex + 1}</p>
              <h4>{revealed ? current.ticker : "Instrument Hidden"}</h4>
            </div>
            <span className={`inline-tag ${current.direction === "LONG" ? "green" : "red"}`}>
              {current.direction}
            </span>
          </div>

          <div className="blind-eval-chart-shell">
            {loading ? (
              <div className="blind-eval-loading">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading blind chart</span>
              </div>
            ) : (
              <PriceChart candles={candles} height={310} blindMode={!revealed} />
            )}
          </div>

          <div className="blind-eval-chart-foot">
            <span>{revealed ? "Ticker unlocked" : "Ticker and price hidden until approval"}</span>
            {revealed && <span className="blind-eval-reveal-tag">Revealed</span>}
          </div>
        </div>

        <div className="blind-eval-side-panel">
          <div className="blind-eval-rule-stack">
            <div className="blind-eval-meta-row">
              <span className="blind-eval-meta-label">Assigned strategy</span>
              <span className="blind-eval-meta-value">{activeStrategy?.name} v{activeStrategy?.versionNumber}</span>
            </div>
            <div className="blind-eval-meta-row">
              <span className="blind-eval-meta-label">Enabled checks</span>
              <span className="blind-eval-meta-value">{enabledMetrics.length} enabled / {hardMetrics.length} hard</span>
            </div>
            <p className="blind-eval-strategy-copy">{activeStrategy?.description}</p>
            <div className="blind-eval-rule-list">
              {enabledMetrics.slice(0, 5).map((metric) => (
                <span key={metric.id} className={`blind-eval-rule-chip ${metric.isHard ? "hard" : "soft"}`}>
                  {metric.name}
                </span>
              ))}
            </div>
          </div>

          <div className="blind-eval-signals">
            <p className="blind-eval-panel-label">Anonymized technical read</p>
            <div className="blind-eval-signal-grid">
              {signals.map((signal) => (
                <article key={signal.label} className="blind-eval-signal-card">
                  <span className="blind-eval-signal-label">{signal.label}</span>
                  <strong>{signal.value}</strong>
                </article>
              ))}
            </div>
          </div>

          <div className="blind-eval-stats">
            <article>
              <Gamepad2 className="h-4 w-4" />
              <strong>{stats.reviewed}</strong>
              <span>Rounds</span>
            </article>
            <article>
              <Shield className="h-4 w-4" />
              <strong>{stats.approved}</strong>
              <span>Approved</span>
            </article>
            <article>
              <SkipForward className="h-4 w-4" />
              <strong>{stats.skipped}</strong>
              <span>Skipped</span>
            </article>
          </div>

          {!revealed ? (
            <div className="blind-eval-actions">
              <button className="blind-eval-primary" onClick={() => completeRound("approved")}>
                <Eye className="h-4 w-4" />
                Approve structure
              </button>
              <button className="blind-eval-secondary" onClick={() => completeRound("skipped")}>
                <RefreshCw className="h-4 w-4" />
                Pass challenge
              </button>
            </div>
          ) : (
            <div className="blind-eval-actions blind-eval-actions-revealed">
              <div className="blind-eval-reveal-card">
                <p className="blind-eval-panel-label">Reveal</p>
                <h4>{current.ticker}</h4>
                <p>{current.strategyLabel}</p>
                <span className="blind-eval-fit-tag">Qualified at {Math.round(current.passRate * 100)}% fit</span>
              </div>
              <div className="blind-eval-revealed-cta">
                <Link className="blind-eval-primary blind-eval-link" href={buildExecutionHref(current, current.strategyId ?? activeStrategy?.id ?? "")}>
                  Execute revealed setup
                </Link>
                <button className="blind-eval-secondary" onClick={() => setCandidateIndex((previous) => (previous + 1) % candidates.length)}>
                  Next challenge
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
