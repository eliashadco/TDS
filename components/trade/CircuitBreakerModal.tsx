"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CircuitBreakerStatus } from "@/lib/trading/circuit-breaker";

/* ---------- Types ---------- */

type CircuitBreakerModalProps = {
  open: boolean;
  status: CircuitBreakerStatus;
  onReview: () => void;
  onOverride: () => void;
  onClose: () => void;
};

/* ---------- Component ---------- */

export default function CircuitBreakerModal({
  open,
  status,
  onReview,
  onOverride,
  onClose,
}: CircuitBreakerModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setAcknowledged(false);
      setCountdown(30);
    }
  }, [open]);

  // Countdown timer after acknowledgment
  useEffect(() => {
    if (!acknowledged || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [acknowledged, countdown]);

  if (!open) return null;

  return (
    <div className="circuit-breaker-backdrop" onClick={onClose}>
      <div
        className="circuit-breaker-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Circuit breaker warning"
      >
        {/* Header */}
        <div className="circuit-breaker-header">
          <div className="circuit-breaker-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 className="circuit-breaker-title">Strategy Paused</h2>
          <p className="circuit-breaker-subtitle">Circuit breaker has been triggered</p>
        </div>

        {/* Reason */}
        <div className="circuit-breaker-reason">
          <span className="circuit-breaker-reason-label">Reason</span>
          <p className="circuit-breaker-reason-text">{status.reason}</p>
        </div>

        {/* Stats */}
        <div className="circuit-breaker-stats">
          <div className="circuit-breaker-stat">
            <span className="circuit-breaker-stat-value">{status.consecutiveLosses}</span>
            <span className="circuit-breaker-stat-label">
              Consecutive Losses (limit: {status.config.maxConsecutiveLosses})
            </span>
          </div>
          <div className="circuit-breaker-stat">
            <span className="circuit-breaker-stat-value">{status.drawdownPercent.toFixed(1)}%</span>
            <span className="circuit-breaker-stat-label">
              Drawdown (limit: {status.config.maxDrawdownPercent}%)
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="circuit-breaker-actions">
          <Button
            className="circuit-breaker-btn-review"
            onClick={onReview}
          >
            Review Strategy
          </Button>

          {!acknowledged ? (
            <button
              className="circuit-breaker-btn-override-init"
              onClick={() => setAcknowledged(true)}
            >
              Override Anyway
            </button>
          ) : (
            <button
              className="circuit-breaker-btn-override"
              disabled={countdown > 0}
              onClick={onOverride}
            >
              {countdown > 0
                ? `Confirm Override (${countdown}s)`
                : "Confirm Override"}
            </button>
          )}
        </div>

        {acknowledged && countdown > 0 && (
          <p className="circuit-breaker-timer-warning">
            Proceed deliberately. Overriding the circuit breaker applies maximum friction to all subsequent gates.
          </p>
        )}
      </div>
    </div>
  );
}
