"use client";

import { getStrategyPresetsForMode } from "@/lib/trading/strategy-presets";
import type { TradeMode } from "@/types/trade";
import type { StrategyPresetDefinition } from "@/types/strategy";

type StrategyTemplateProps = {
  mode: TradeMode;
  busyPresetKey?: string | null;
  message?: string | null;
  onClonePreset: (preset: StrategyPresetDefinition) => void;
};

export default function StrategyTemplate({ mode, busyPresetKey = null, message = null, onClonePreset }: StrategyTemplateProps) {
  const presets = getStrategyPresetsForMode(mode);

  return (
    <section className="rounded-xl border border-tds-border bg-tds-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-sm text-tds-text">Preset Playbooks</h2>
          <p className="mt-2 text-sm leading-6 text-tds-dim">
            Clone a starter strategy into your own workspace. Presets are guides, not hidden defaults, so every clone becomes a named strategy you can evolve and version.
          </p>
        </div>
        <span className="rounded-full bg-tds-input px-3 py-1 font-mono text-xs text-tds-dim">{presets.length} presets</span>
      </div>

      <div className="mt-4 space-y-3">
        {presets.map((preset) => (
          <article key={preset.key} className="rounded-lg border border-tds-border bg-tds-input p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm text-tds-text">{preset.name}</p>
                  <span className="rounded-full bg-tds-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-tds-text">
                    {preset.metricIds.length} checks
                  </span>
                </div>
                <p className="mt-2 text-sm text-tds-dim">{preset.description}</p>
              </div>

              <button
                type="button"
                disabled={busyPresetKey === preset.key}
                onClick={() => onClonePreset(preset)}
                className="rounded-md bg-tds-blue px-3 py-2 text-xs text-tds-text hover:bg-blue-500 disabled:opacity-50"
              >
                {busyPresetKey === preset.key ? "Cloning..." : "Clone Strategy"}
              </button>
            </div>

            <div className="mt-3 grid gap-3 text-xs text-tds-dim md:grid-cols-2">
              <p>Learning goal: {preset.learningGoal}</p>
              <p>When not to use: {preset.whenNotToUse}</p>
              <p>Sizing: {preset.sizingNotes}</p>
              <p>Walkthrough: {preset.walkthrough}</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {preset.setupTypes.map((setup) => (
                <span key={setup} className="rounded-full border border-tds-border bg-tds-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-tds-dim">
                  {setup}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      {message ? <p className="mt-3 text-xs text-tds-dim">{message}</p> : null}
    </section>
  );
}
