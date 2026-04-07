"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLearnMode } from "@/components/learn/LearnModeContext";

type LearnToggleProps = {
  userId: string;
};

export default function LearnToggle({ userId }: LearnToggleProps) {
  const supabase = useMemo(() => createClient(), []);
  const { learnMode, setLearnMode } = useLearnMode();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onToggle() {
    const nextValue = !learnMode;
    setError(null);
    setSaving(true);
    setLearnMode(nextValue);

    const { error: updateError } = await supabase.from("profiles").update({ learn_mode: nextValue }).eq("id", userId);
    if (updateError) {
      setLearnMode(!nextValue);
      setError("Failed to update Learn Mode.");
    }
    setSaving(false);
  }

  return (
    <section className="rounded-xl border border-tds-border bg-tds-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-sm text-tds-text">Learn Mode</h2>
          <p className="mt-1 text-xs text-tds-dim">Show contextual explanations across thesis, assessment, sizing, and analytics.</p>
        </div>

        <label
          className={`relative block h-7 w-14 rounded-full border transition-colors ${
            learnMode ? "border-tds-blue bg-tds-blue/30" : "border-tds-border bg-tds-input"
          } ${saving ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          title="Toggle Learn Mode"
        >
          <input
            type="checkbox"
            checked={learnMode}
            disabled={saving}
            onChange={() => void onToggle()}
            aria-label="Toggle Learn Mode"
            className="sr-only"
          />
          <span className="sr-only">Toggle Learn Mode</span>
          <span
            className={`pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-tds-text transition-transform ${
              learnMode ? "translate-x-8" : "translate-x-1"
            }`}
          />
        </label>
      </div>

      <p className="mt-2 font-mono text-xs text-tds-dim">{saving ? "Saving..." : learnMode ? "Enabled" : "Disabled"}</p>
      {error ? <p className="mt-1 text-xs text-tds-red">{error}</p> : null}
    </section>
  );
}
