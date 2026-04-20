"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PortfolioResetCardProps = {
  currentMode: string | null;
  equity: number;
};

type ResetScope = "activity" | "full";

export default function PortfolioResetCard({ currentMode, equity }: PortfolioResetCardProps) {
  const router = useRouter();
  const [isArmed, setIsArmed] = useState(false);
  const [scope, setScope] = useState<ResetScope>("activity");
  const [confirmationText, setConfirmationText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function resetWorkspace() {
    if (confirmationText.trim().toUpperCase() !== "RESET") {
      setError('Type RESET to confirm the wipe.');
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/settings/reset-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Workspace reset failed.");
      }

      setMessage(payload.message ?? "Portfolio reset complete.");
      setConfirmationText("");
      setIsArmed(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Workspace reset failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="surface-panel danger-panel settings-side-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="meta-label">Danger Zone</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Clear the portfolio workspace and start fresh.</h3>
          <p className="mt-3 text-sm leading-7 text-tds-dim">
            Choose whether to clear only trading activity or wipe the whole workspace. Your login, Learn Mode setting, current mode,
            and portfolio equity stay in place.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsArmed((previous) => !previous);
            setError(null);
            setMessage(null);
          }}
          className={isArmed ? "secondary-button" : "primary-button"}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {isArmed ? "Cancel reset" : "Reset portfolio"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="settings-info-card">
          <p className="meta-label">Current Mode</p>
          <strong>{currentMode ?? "Not set"}</strong>
          <p>Operational lane is preserved.</p>
        </article>
        <article className="settings-info-card">
          <p className="meta-label">Equity Kept</p>
          <strong>{equity.toLocaleString("en-US")}</strong>
          <p>Capital baseline remains unchanged.</p>
        </article>
        <article className="settings-info-card">
          <p className="meta-label">What Returns</p>
          <strong>{scope === "full" ? "Starter strategy workspace" : "Current strategy workspace"}</strong>
          <p>{scope === "full" ? "Re-seeded for active mode after wipe." : "Metrics and shared structure stay intact."}</p>
        </article>
      </div>

      <div className="settings-action-row">
        <button type="button" className={scope === "activity" ? "primary-button" : "secondary-button"} onClick={() => setScope("activity")}>
          Reset trades + watchlists
        </button>
        <button type="button" className={scope === "full" ? "primary-button" : "secondary-button"} onClick={() => setScope("full")}>
          Full workspace reset
        </button>
      </div>

      <p className="mt-3 text-sm text-tds-dim">
        {scope === "activity"
          ? "Activity reset removes trade history and watchlist state but preserves saved strategies, metrics, and shared structure items."
          : "Full reset removes trade history, watchlists, saved strategies, linked metrics, and shared structure-library entries, then reseeds the current mode."}
      </p>

      {isArmed ? (
        <div className="mt-6 rounded-[24px] border border-tds-red/20 bg-tds-red/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-tds-red" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-tds-text">Destructive action</p>
              <p className="mt-2 text-sm leading-6 text-tds-dim">
                Type RESET to confirm. This {scope === "full" ? "full workspace wipe" : "activity wipe"} cannot be undone from the UI.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Input
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value.toUpperCase())}
                  placeholder="Type RESET"
                  className="max-w-[220px]"
                />
                <Button type="button" onClick={() => void resetWorkspace()} disabled={submitting || isPending}>
                  {submitting || isPending ? "Resetting..." : "Confirm reset"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-4 text-sm text-tds-green">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-tds-red">{error}</p> : null}
    </section>
  );
}