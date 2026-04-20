"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { validateJustification } from "@/lib/trading/override";
import type { DisciplineProfile } from "@/types/trade";

/* ---------- Types ---------- */

type FrictionStep = "idle" | "warning" | "timer" | "justification" | "feedback";

type OverrideHistory = {
  ticker: string;
  direction: string;
  rulesBroken: string[];
  qualityFlag: string;
  pnlPct: number | null;
  closed: boolean;
  createdAt: string;
};

type OverrideSummary = {
  total: number;
  closedCount: number;
  wins: number;
  losses: number;
  avgPnlPct: number | null;
};

type HypotheticalPnl = {
  actualPnlPct: number;
  withoutOverridesPnlPct: number;
  overrideImpactPct: number;
  overrideTradeCount: number;
};

type InlineFrictionZoneProps = {
  rulesBroken: string[];
  ticker: string;
  direction: "LONG" | "SHORT";
  disciplineProfile: DisciplineProfile;
  gateReason: string;
  onConfirm: (justification: string) => Promise<void>;
};

/* ---------- Component ---------- */

export default function InlineFrictionZone({
  rulesBroken,
  ticker,
  direction,
  disciplineProfile,
  gateReason,
  onConfirm,
}: InlineFrictionZoneProps) {
  const [step, setStep] = useState<FrictionStep>("idle");
  const [timerLeft, setTimerLeft] = useState(0);
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [history, setHistory] = useState<OverrideHistory[]>([]);
  const [historySummary, setHistorySummary] = useState<OverrideSummary | null>(null);
  const [hypothetical, setHypothetical] = useState<HypotheticalPnl | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timerDuration = disciplineProfile === "strict" ? 30 : disciplineProfile === "balanced" ? 15 : 0;

  /* --- Fetch history when friction is triggered --- */
  const fetchHistory = useCallback(() => {
    void fetch("/api/trade/override-history?limit=5")
      .then((r) => r.json())
      .then((data) => {
        setHistory(data.overrides ?? []);
        setHistorySummary(data.summary ?? null);
        setHypothetical(data.hypothetical ?? null);
      })
      .catch(() => {});
  }, []);

  /* --- Start the override flow --- */
  function startOverride() {
    fetchHistory();
    setStep("warning");
    setJustification("");
    setSubmitError(null);
  }

  /* --- Timer logic --- */
  const startTimer = useCallback(() => {
    if (timerDuration === 0) {
      setStep("justification");
      return;
    }
    setTimerLeft(timerDuration);
    setStep("timer");
  }, [timerDuration]);

  useEffect(() => {
    if (step !== "timer") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimerLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setStep("justification");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [step]);

  /* --- Justification validation --- */
  const justResult = validateJustification(justification);

  /* --- Submit --- */
  async function handleSubmit() {
    if (!justResult.valid) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      await onConfirm(justification);
      setStep("feedback");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Override failed. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  function collapse() {
    setStep("idle");
  }

  const failedOverrides = history.filter((h) => h.pnlPct !== null && h.pnlPct < 0).slice(0, 3);

  /* ── Idle: show blocked banner with inline override CTA ── */
  if (step === "idle") {
    return (
      <div className="override-blocked-banner">
        <p className="override-blocked-title">Trade Blocked</p>
        <p className="override-blocked-reason">{gateReason}</p>
        <div className="override-blocked-actions">
          <Button className="override-btn" onClick={startOverride}>
            Request Exception Override
          </Button>
        </div>
      </div>
    );
  }

  /* ── Feedback: confirmed ── */
  if (step === "feedback") {
    return (
      <div className="inline-friction-zone inline-friction-feedback">
        <div className="inline-friction-icon">⚡</div>
        <h4 className="inline-friction-title">Override Approved</h4>
        <p className="inline-friction-dim">
          <span className="font-mono">{ticker} {direction}</span> — classified as <span className="inline-friction-override-badge">OVERRIDE</span>
        </p>
        <p className="inline-friction-dim mt-1">Sizing gate unlocked. Complete sizing and deploy below.</p>
      </div>
    );
  }

  return (
    <div className="inline-friction-zone">
      {/* Header bar */}
      <div className="inline-friction-header">
        <span className="inline-friction-header-icon">⚠</span>
        <span className="inline-friction-header-text">Override Flow — {ticker} {direction}</span>
        <button className="inline-friction-collapse" onClick={collapse} aria-label="Cancel override">
          ✕
        </button>
      </div>

      {/* Step 1: Warning + Accountability Mirror */}
      {step === "warning" && (
        <div className="inline-friction-step">
          <h4 className="inline-friction-title">This trade violates your strategy</h4>

          <div className="inline-friction-rules">
            <p className="inline-friction-label">Broken Rules:</p>
            {rulesBroken.map((rule, i) => (
              <div key={i} className="inline-friction-rule-item">
                <span className="inline-friction-rule-x">✖</span>
                {rule}
              </div>
            ))}
          </div>

          {/* Hall of Shame */}
          {failedOverrides.length > 0 && (
            <div className="inline-friction-mirror">
              <p className="inline-friction-label">Recent Failed Overrides</p>
              <div className="inline-friction-shame-list">
                {failedOverrides.map((h) => (
                  <div key={h.createdAt} className="inline-friction-shame-card">
                    <span className="font-mono text-xs">{h.ticker} {h.direction}</span>
                    <span className="inline-friction-shame-pnl">{h.pnlPct!.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hypothetical P&L */}
          {hypothetical && hypothetical.overrideTradeCount > 0 && (
            <div className="inline-friction-mirror">
              <p className="inline-friction-label">P&L Comparison</p>
              <div className="inline-friction-pnl-bars">
                <div className="inline-friction-pnl-row">
                  <span className="inline-friction-pnl-label">Actual</span>
                  <div className="inline-friction-pnl-track">
                    <div
                      className={`inline-friction-pnl-fill ${hypothetical.actualPnlPct >= 0 ? "positive" : "negative"}`}
                      style={{ width: `${Math.min(100, Math.abs(hypothetical.actualPnlPct) * 2 + 10)}%` }}
                    />
                  </div>
                  <span className={`inline-friction-pnl-value ${hypothetical.actualPnlPct >= 0 ? "positive" : "negative"}`}>
                    {hypothetical.actualPnlPct >= 0 ? "+" : ""}{hypothetical.actualPnlPct.toFixed(1)}%
                  </span>
                </div>
                <div className="inline-friction-pnl-row">
                  <span className="inline-friction-pnl-label">Without overrides</span>
                  <div className="inline-friction-pnl-track">
                    <div
                      className={`inline-friction-pnl-fill ${hypothetical.withoutOverridesPnlPct >= 0 ? "positive" : "negative"}`}
                      style={{ width: `${Math.min(100, Math.abs(hypothetical.withoutOverridesPnlPct) * 2 + 10)}%` }}
                    />
                  </div>
                  <span className={`inline-friction-pnl-value ${hypothetical.withoutOverridesPnlPct >= 0 ? "positive" : "negative"}`}>
                    {hypothetical.withoutOverridesPnlPct >= 0 ? "+" : ""}{hypothetical.withoutOverridesPnlPct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <p className="inline-friction-impact">
                Override impact: <span className={hypothetical.overrideImpactPct >= 0 ? "positive" : "negative"}>
                  {hypothetical.overrideImpactPct >= 0 ? "+" : ""}{hypothetical.overrideImpactPct.toFixed(1)}%
                </span>
                {" "}across {hypothetical.overrideTradeCount} trade{hypothetical.overrideTradeCount === 1 ? "" : "s"}
              </p>
            </div>
          )}

          {historySummary && (
            <p className="inline-friction-summary">
              {historySummary.wins}W / {historySummary.losses}L · Avg: {historySummary.avgPnlPct != null ? `${historySummary.avgPnlPct >= 0 ? "+" : ""}${historySummary.avgPnlPct.toFixed(1)}%` : "—"}
            </p>
          )}

          {history.length === 0 && (
            <p className="inline-friction-dim mt-2">No override history yet. This will be your first override on record.</p>
          )}

          <div className="inline-friction-actions">
            <Button variant="secondary" className="secondary-button" onClick={collapse}>
              Cancel
            </Button>
            <Button className="override-proceed-btn" onClick={startTimer}>
              Proceed to Override
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Friction Timer */}
      {step === "timer" && (
        <div className="inline-friction-step inline-friction-timer-step">
          <div className="inline-friction-countdown">
            <span className="inline-friction-countdown-number">{timerLeft}</span>
            <span className="inline-friction-countdown-unit">s</span>
          </div>
          <p className="inline-friction-dim">Reflect on this decision. This action reduces your discipline score.</p>
        </div>
      )}

      {/* Step 3: Justification */}
      {step === "justification" && (
        <div className="inline-friction-step">
          <h4 className="inline-friction-title">Explain your reasoning</h4>

          <textarea
            className="inline-friction-textarea"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Logically justify this exception (min 8 words)…"
            rows={3}
            maxLength={1000}
            autoFocus
          />

          <div className="inline-friction-meta">
            <span className={justResult.valid ? "positive" : "text-tds-dim"}>
              {justResult.wordCount} / 8 words min
            </span>
            {justResult.reason && justification.length > 0 && (
              <span className="text-tds-amber">{justResult.reason}</span>
            )}
          </div>

          {submitError && <p className="text-sm text-tds-red">{submitError}</p>}

          <div className="inline-friction-actions">
            <Button variant="secondary" className="secondary-button" onClick={collapse}>
              Cancel
            </Button>
            <Button
              className="override-submit-btn"
              disabled={!justResult.valid || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Submitting…" : "Confirm Out-of-Bounds Execution"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
