"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { validateJustification } from "@/lib/trading/override";
import type { DisciplineProfile } from "@/types/trade";

/* ---------- Types ---------- */

type OverrideStep = "warning" | "timer" | "justification" | "feedback";

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

type OverrideModalProps = {
  open: boolean;
  rulesBroken: string[];
  ticker: string;
  direction: "LONG" | "SHORT";
  disciplineProfile: DisciplineProfile;
  onClose: () => void;
  onConfirm: (justification: string) => Promise<void>;
};

/* ---------- Component ---------- */

export default function OverrideModal({
  open,
  rulesBroken,
  ticker,
  direction,
  disciplineProfile,
  onClose,
  onConfirm,
}: OverrideModalProps) {
  const [step, setStep] = useState<OverrideStep>("warning");
  const [timerLeft, setTimerLeft] = useState(0);
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [feedbackQuality, setFeedbackQuality] = useState<string | null>(null);
  const [history, setHistory] = useState<OverrideHistory[]>([]);
  const [historySummary, setHistorySummary] = useState<OverrideSummary | null>(null);
  const [hypothetical, setHypothetical] = useState<HypotheticalPnl | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timerDuration = disciplineProfile === "strict" ? 30 : disciplineProfile === "balanced" ? 15 : 0;

  /* --- Reset on open --- */
  useEffect(() => {
    if (open) {
      setStep("warning");
      setJustification("");
      setSubmitting(false);
      setSubmitError(null);
      setFeedbackQuality(null);

      // Fetch override history for memory injection (§9.5)
      void fetch("/api/trade/override-history?limit=5")
        .then((r) => r.json())
        .then((data) => {
          setHistory(data.overrides ?? []);
          setHistorySummary(data.summary ?? null);
          setHypothetical(data.hypothetical ?? null);
        })
        .catch(() => {});
    }
  }, [open]);

  /* --- Timer logic --- */
  const startTimer = useCallback(() => {
    if (timerDuration === 0) {
      // Expert mode: skip timer
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

  /* --- Submit override --- */
  async function handleSubmit() {
    if (!justResult.valid) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      await onConfirm(justification);
      setFeedbackQuality("override");
      setStep("feedback");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Override failed. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="override-backdrop" onClick={onClose}>
      <div className="override-modal" onClick={(e) => e.stopPropagation()}>
        {/* Step 1: Warning + Accountability Mirror (§31.3 Step 1 + §9.5) */}
        {step === "warning" && (
          <div className="override-step">
            <div className="override-warning-icon">⚠</div>
            <h3 className="override-title">This trade violates your strategy</h3>

            <div className="override-rules-list">
              <p className="override-rules-label">Broken Rules:</p>
              {rulesBroken.map((rule, i) => (
                <div key={i} className="override-rule-item">
                  <span className="override-rule-x">✖</span>
                  {rule}
                </div>
              ))}
            </div>

            {/* Accountability Mirror — Hall of Shame */}
            {history.length > 0 && (
              <div className="override-mirror">
                <p className="override-mirror-label">Hall of Shame — Recent Failed Overrides</p>
                <div className="override-shame-list">
                  {history
                    .filter((h) => h.pnlPct !== null && h.pnlPct < 0)
                    .slice(0, 3)
                    .map((h) => (
                      <div key={h.createdAt} className="override-shame-card">
                        <div className="override-shame-ticker">
                          <span className="font-mono">{h.ticker}</span>
                          <span className="override-shame-direction">{h.direction}</span>
                        </div>
                        <div className="override-shame-pnl">
                          {h.pnlPct!.toFixed(1)}%
                        </div>
                        <div className="override-shame-rules">
                          {h.rulesBroken.slice(0, 2).map((rule, idx) => (
                            <span key={idx} className="override-shame-rule">{rule}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  {history.filter((h) => h.pnlPct !== null && h.pnlPct < 0).length === 0 && (
                    <p className="text-sm text-tds-dim">No failed overrides yet — keep it that way.</p>
                  )}
                </div>

                {/* Hypothetical P&L bar — what if zero overrides? */}
                {hypothetical && hypothetical.overrideTradeCount > 0 && (
                  <div className="override-mirror-chart">
                    <p className="override-mirror-chart-label">P&L Comparison</p>
                    <div className="override-pnl-bars">
                      <div className="override-pnl-bar-row">
                        <span className="override-pnl-bar-label">Actual</span>
                        <div className="override-pnl-bar-track">
                          <div
                            className={`override-pnl-bar-fill ${hypothetical.actualPnlPct >= 0 ? "positive" : "negative"}`}
                            style={{ width: `${Math.min(100, Math.abs(hypothetical.actualPnlPct) * 2 + 10)}%` }}
                          />
                        </div>
                        <span className={`override-pnl-bar-value ${hypothetical.actualPnlPct >= 0 ? "positive" : "negative"}`}>
                          {hypothetical.actualPnlPct >= 0 ? "+" : ""}{hypothetical.actualPnlPct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="override-pnl-bar-row">
                        <span className="override-pnl-bar-label">Without overrides</span>
                        <div className="override-pnl-bar-track">
                          <div
                            className={`override-pnl-bar-fill ${hypothetical.withoutOverridesPnlPct >= 0 ? "positive" : "negative"}`}
                            style={{ width: `${Math.min(100, Math.abs(hypothetical.withoutOverridesPnlPct) * 2 + 10)}%` }}
                          />
                        </div>
                        <span className={`override-pnl-bar-value ${hypothetical.withoutOverridesPnlPct >= 0 ? "positive" : "negative"}`}>
                          {hypothetical.withoutOverridesPnlPct >= 0 ? "+" : ""}{hypothetical.withoutOverridesPnlPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <p className="override-mirror-impact">
                      Override impact: <span className={hypothetical.overrideImpactPct >= 0 ? "positive" : "negative"}>
                        {hypothetical.overrideImpactPct >= 0 ? "+" : ""}{hypothetical.overrideImpactPct.toFixed(1)}%
                      </span>
                      {" "}across {hypothetical.overrideTradeCount} override trade{hypothetical.overrideTradeCount === 1 ? "" : "s"}
                    </p>
                  </div>
                )}

                {historySummary && (
                  <p className="override-memory-summary">
                    {historySummary.wins}W / {historySummary.losses}L · Avg: {historySummary.avgPnlPct != null ? `${historySummary.avgPnlPct >= 0 ? "+" : ""}${historySummary.avgPnlPct.toFixed(1)}%` : "—"}
                  </p>
                )}
              </div>
            )}

            {/* Fallback when no history exists yet */}
            {history.length === 0 && (
              <div className="override-memory">
                <p className="override-memory-label">No override history yet</p>
                <p className="text-sm text-tds-dim">This will be your first override on record.</p>
              </div>
            )}

            <div className="override-actions">
              <Button variant="secondary" className="secondary-button" onClick={onClose}>
                Cancel
              </Button>
              <Button className="override-proceed-btn" onClick={startTimer}>
                Proceed to Override
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Friction Timer (§31.3 Step 2) */}
        {step === "timer" && (
          <div className="override-step override-timer-step">
            <div className="override-timer-icon">⏳</div>
            <h3 className="override-title">Confirming override…</h3>

            <div className="override-countdown">
              <span className="override-countdown-number">{timerLeft}</span>
              <span className="override-countdown-label">seconds</span>
            </div>

            <p className="override-timer-warning">
              Proceed deliberately. This action reduces your discipline score.
            </p>
          </div>
        )}

        {/* Step 3: Justification Input (§31.3 Step 3) */}
        {step === "justification" && (
          <div className="override-step">
            <h3 className="override-title">Explain your reasoning</h3>

            <textarea
              className="override-justification-input"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Why are you overriding the system? Be specific about the opportunity you see despite the failed rules…"
              rows={4}
              maxLength={1000}
              autoFocus
            />

            <div className="override-justification-meta">
              <span className={justResult.valid ? "text-tds-green" : "text-tds-dim"}>
                {justResult.wordCount} / {8} words min
              </span>
              {justResult.reason && justification.length > 0 && (
                <span className="text-tds-amber">{justResult.reason}</span>
              )}
            </div>

            {submitError && <p className="text-sm text-tds-red">{submitError}</p>}

            <div className="override-actions">
              <Button variant="secondary" className="secondary-button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                className="override-submit-btn"
                disabled={!justResult.valid || submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Submitting…" : "Submit Override"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation Feedback (§31.3 Step 4) */}
        {step === "feedback" && (
          <div className="override-step override-feedback-step">
            <div className="override-feedback-icon">⚡</div>
            <h3 className="override-title">Override Executed</h3>

            <div className="override-feedback-details">
              <p>
                <span className="text-tds-dim">Trade:</span>{" "}
                <span className="font-mono">{ticker} {direction}</span>
              </p>
              <p>
                <span className="text-tds-dim">Classification:</span>{" "}
                <span className="override-classification-badge">OVERRIDE</span>
              </p>
              {feedbackQuality && (
                <p>
                  <span className="text-tds-dim">Quality:</span>{" "}
                  <span className="override-quality-badge">{feedbackQuality.replace(/_/g, " ").toUpperCase()}</span>
                </p>
              )}
            </div>

            <Button className="primary-button mt-4" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
