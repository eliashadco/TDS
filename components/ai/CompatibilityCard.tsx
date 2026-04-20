"use client";

import { useCallback, useState } from "react";
import type React from "react";
import { cn } from "@/lib/utils";
import { extractAIResponseMeta, type AIResponseMeta } from "@/lib/ai/response";
import type { CompatibilityResult } from "@/lib/trading/compatibility";

/* ---------- Props ---------- */

export type CompatibilityCardProps = {
  /** Ticker to assess. */
  ticker: string;
  /** Strategy id to assess against. */
  strategyId: string;
  /** Trade direction for the assessment. */
  direction: "LONG" | "SHORT";
  /** Optional class override for outer wrapper. */
  className?: string;
  /**
   * Called when the user clicks "Open in Trade Studio" with a prefill URL.
   * If omitted the link is rendered as a plain anchor.
   */
  onOpenTrade?: (ticker: string, direction: "LONG" | "SHORT", result: CompatibilityResult) => void;
};

/* ---------- State ---------- */

type CardState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "result"; result: CompatibilityResult; meta: AIResponseMeta | null }
  | { status: "error"; message: string };

/* ---------- Helpers ---------- */

function actionLabel(action: CompatibilityResult["gateResult"]["action"]): string {
  if (action === "proceed") return "PROCEED";
  if (action === "watchlist") return "WATCHLIST";
  return "BLOCKED";
}

function actionClass(action: CompatibilityResult["gateResult"]["action"]): string {
  if (action === "proceed") return "compat-action-proceed";
  if (action === "watchlist") return "compat-action-watchlist";
  return "compat-action-blocked";
}

function convictionClass(tier: string): string {
  if (tier === "MAX") return "compat-conviction-max";
  if (tier === "HIGH") return "compat-conviction-high";
  return "compat-conviction-std";
}

function pct(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

/* ---------- Sub-components ---------- */

function GateBar({
  label,
  score,
  total,
  passed,
}: {
  label: string;
  score: number;
  total: number;
  passed: boolean;
}) {
  const fillPct = total > 0 ? (score / total) * 100 : 0;

  return (
    <div className="compat-gate-bar">
      <div className="compat-gate-bar-header">
        <span className="compat-gate-label">{label}</span>
        <span className={cn("compat-gate-score", passed ? "compat-gate-score-pass" : "compat-gate-score-fail")}>
          {score}/{total}
        </span>
      </div>
      <div className="compat-gate-track">
        <div
          className={cn("compat-gate-fill", passed ? "compat-gate-fill-pass" : "compat-gate-fill-fail")}
          style={{ "--compat-fill-pct": `${fillPct}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

export default function CompatibilityCard({
  ticker,
  strategyId,
  direction,
  className,
  onOpenTrade,
}: CompatibilityCardProps) {
  const [state, setState] = useState<CardState>({ status: "idle" });

  const runAssessment = useCallback(async () => {
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/ai/compatibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, strategyId, direction }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setState({ status: "error", message: body.error ?? `Request failed (${response.status})` });
        return;
      }

      const result = (await response.json()) as CompatibilityResult;
      const meta = extractAIResponseMeta(response);
      setState({ status: "result", result, meta });
    } catch {
      setState({ status: "error", message: "Network error — check connection and retry." });
    }
  }, [ticker, strategyId, direction]);

  /* ---- Idle ---- */
  if (state.status === "idle") {
    return (
      <div className={cn("compat-card compat-card-idle", className)}>
        <div className="compat-card-identity">
          <span className="compat-ticker">{ticker}</span>
          <span className={cn("compat-direction-badge", direction === "LONG" ? "compat-direction-long" : "compat-direction-short")}>
            {direction}
          </span>
        </div>
        <button className="compat-run-btn" onClick={runAssessment} aria-label={`Score ${ticker} against strategy`}>
          Score compatibility
        </button>
      </div>
    );
  }

  /* ---- Loading ---- */
  if (state.status === "loading") {
    return (
      <div className={cn("compat-card compat-card-loading", className)} aria-busy="true">
        <div className="compat-card-identity">
          <span className="compat-ticker">{ticker}</span>
          <span className={cn("compat-direction-badge", direction === "LONG" ? "compat-direction-long" : "compat-direction-short")}>
            {direction}
          </span>
        </div>
        <div className="compat-loading-row">
          <span className="compat-spinner" aria-hidden="true" />
          <span className="compat-loading-label">Scoring against strategy…</span>
        </div>
        <div className="compat-skeleton-bars">
          <div className="compat-skeleton-bar" />
          <div className="compat-skeleton-bar compat-skeleton-bar--short" />
        </div>
      </div>
    );
  }

  /* ---- Error ---- */
  if (state.status === "error") {
    return (
      <div className={cn("compat-card compat-card-error", className)}>
        <div className="compat-card-identity">
          <span className="compat-ticker">{ticker}</span>
        </div>
        <p className="compat-error-msg">{state.message}</p>
        <button className="compat-run-btn" onClick={runAssessment}>
          Retry
        </button>
      </div>
    );
  }

  /* ---- Result ---- */
  const { result } = state;
  const { gateResult, conviction } = result;
  const totalScore = result.fundamentalScore + result.technicalScore;
  const totalPossible = result.fundamentalTotal + result.technicalTotal;

  const tradeHref = `/trade/new?ticker=${encodeURIComponent(result.ticker)}&direction=${result.direction}&strategyId=${encodeURIComponent(result.strategyId)}`;

  return (
    <div className={cn("compat-card compat-card-result", className)}>
      {/* Identity row */}
      <div className="compat-card-identity">
        <span className="compat-ticker">{ticker}</span>
        <span className={cn("compat-direction-badge", direction === "LONG" ? "compat-direction-long" : "compat-direction-short")}>
          {direction}
        </span>
        <span className={cn("compat-action-badge", actionClass(gateResult.action))}>
          {actionLabel(gateResult.action)}
        </span>
        {conviction && (
          <span className={cn("compat-conviction-badge", convictionClass(conviction.tier))}>
            {conviction.tier}
          </span>
        )}
      </div>

      {/* Score summary */}
      <div className="compat-score-summary">
        <span className="compat-score-main">{pct(totalScore, totalPossible)}</span>
        <span className="compat-score-detail">
          {totalScore}/{totalPossible} metrics passed
        </span>
      </div>

      {/* Gate bars */}
      <div className="compat-gate-bars">
        <GateBar
          label="F-Gate"
          score={result.fundamentalScore}
          total={result.fundamentalTotal}
          passed={result.fundamentalScore >= Math.max(1, Math.ceil(result.fundamentalTotal * 0.7))}
        />
        <GateBar
          label="T-Gate"
          score={result.technicalScore}
          total={result.technicalTotal}
          passed={result.technicalScore >= result.technicalTotal}
        />
      </div>

      {/* Gate reason (if blocked/watchlisted) */}
      {gateResult.reason && (
        <p className="compat-gate-reason">{gateResult.reason}</p>
      )}

      {/* Actions */}
      <div className="compat-actions">
        {onOpenTrade ? (
          <button
            className="compat-open-btn"
            onClick={() => onOpenTrade(ticker, direction, result)}
          >
            Open in Trade Studio →
          </button>
        ) : (
          <a href={tradeHref} className="compat-open-btn">
            Open in Trade Studio →
          </a>
        )}
        <button
          className="compat-rescore-btn"
          onClick={runAssessment}
          aria-label="Rescore"
        >
          Rescore
        </button>
      </div>

      {/* Provider attribution */}
      {state.meta && (
        <p className="compat-meta-label">
          AI {state.meta.provider}{state.meta.model ? ` · ${state.meta.model}` : ""}
          {" · "}scored {new Date(result.cachedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
