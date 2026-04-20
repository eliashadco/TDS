"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sanitizeTicker } from "@/lib/api/security";
import { Zap, ArrowRight, X } from "lucide-react";

type FastExecProps = {
  userId: string;
  open: boolean;
  onClose: () => void;
};

type FastExecState = "idle" | "fetching" | "ready" | "deploying" | "done" | "error";

/**
 * Fast Execution Palette (TRD v2 §31.9 / §15)
 * Expert-tier power user feature: type a ticker → evaluate → instant deploy
 * Accessed via Ctrl+K or the command palette shortcut.
 */
export default function FastExecPalette({ open, onClose }: FastExecProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [ticker, setTicker] = useState("");
  const [state, setState] = useState<FastExecState>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [scoreInfo, setScoreInfo] = useState<{ score: number; pass: boolean } | null>(null);

  // Focus input when palette opens
  useEffect(() => {
    if (open) {
      setState("idle");
      setTicker("");
      setStatusMessage("");
      setScoreInfo(null);
      // Delay to allow the element to be in the DOM
      const id = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = useCallback(async () => {
    const sanitized = sanitizeTicker(ticker);
    if (!sanitized) {
      setStatusMessage("Enter a valid ticker symbol.");
      return;
    }

    setState("fetching");
    setStatusMessage(`Evaluating ${sanitized}...`);
    setScoreInfo(null);

    try {
      // Fetch compatibility score from the AI endpoint
      const res = await fetch("/api/ai/compatibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: sanitized }),
      });

      if (!res.ok) {
        setState("error");
        setStatusMessage("Evaluation failed. Try the full wizard instead.");
        return;
      }

      const data = await res.json();
      const score = typeof data.score === "number" ? data.score : 0;
      const pass = score >= 60;
      setScoreInfo({ score, pass });

      if (pass) {
        setState("ready");
        setStatusMessage(`${sanitized} scores ${score}/100 — ready to deploy.`);
      } else {
        setState("ready");
        setStatusMessage(`${sanitized} scores ${score}/100 — below threshold. Open full wizard?`);
      }
    } catch {
      setState("error");
      setStatusMessage("Network error during evaluation.");
    }
  }, [ticker]);

  const handleDeploy = useCallback(() => {
    const sanitized = sanitizeTicker(ticker);
    if (!sanitized) return;

    // Navigate to the full trade wizard with the ticker pre-filled
    // This lets the gate system do proper validation
    router.push(`/trade/new?ticker=${encodeURIComponent(sanitized)}`);
    onClose();
  }, [ticker, router, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (state === "idle" || state === "error") {
          void handleSubmit();
        } else if (state === "ready") {
          handleDeploy();
        }
      }
    },
    [state, handleSubmit, handleDeploy],
  );

  if (!open) return null;

  return (
    <div className="fast-exec-overlay" onClick={onClose}>
      <div className="fast-exec-palette" onClick={(e) => e.stopPropagation()}>
        <div className="fast-exec-header">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim">Fast Execution</span>
          <button type="button" onClick={onClose} className="ml-auto text-tds-dim hover:text-tds-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="fast-exec-input-row">
          <input
            ref={inputRef}
            type="text"
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value.toUpperCase());
              setState("idle");
              setScoreInfo(null);
              setStatusMessage("");
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type ticker and press Enter..."
            className="fast-exec-input"
            spellCheck={false}
            autoComplete="off"
          />
          {state === "idle" && ticker.length > 0 && (
            <button type="button" onClick={() => void handleSubmit()} className="fast-exec-go">
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {statusMessage && (
          <div className="fast-exec-status" data-state={state}>
            {scoreInfo && (
              <span
                className="fast-exec-score"
                data-pass={scoreInfo.pass}
              >
                {scoreInfo.score}
              </span>
            )}
            <span>{statusMessage}</span>
          </div>
        )}

        {state === "ready" && (
          <div className="fast-exec-actions">
            <button type="button" onClick={handleDeploy} className="fast-exec-deploy">
              Open Trade Wizard
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <p className="fast-exec-hint">
          <kbd>Enter</kbd> to evaluate · <kbd>Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
