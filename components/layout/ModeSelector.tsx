"use client";

import type { TradeMode } from "@/types/trade";
import { MODE_PRESETS } from "@/lib/trading/presets";

type ModeSelectorProps = {
  open: boolean;
  hasExistingMode: boolean;
  onSelectMode: (mode: TradeMode) => void;
  onCancel: () => void;
};

const MODES: Array<{ mode: TradeMode; icon: string; label: string; description: string }> = [
  { mode: "investment", icon: "📈", label: "Investment", description: "Months and macro-led positioning." },
  { mode: "swing", icon: "🔄", label: "Swing", description: "Days to weeks with trend follow-through." },
  { mode: "daytrade", icon: "⚡", label: "Day Trade", description: "Intraday momentum and execution precision." },
  { mode: "scalp", icon: "💨", label: "Scalp", description: "Ultra-fast tactical entries and exits." },
];

export default function ModeSelector({ open, hasExistingMode, onSelectMode, onCancel }: ModeSelectorProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="fin-shell w-full max-w-5xl p-6 sm:p-8">
        <div className="fin-hero p-6 sm:p-8">
          <p className="fin-chip fin-chip-strong">Mode Selector</p>
          <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">Choose the operating mode that matches your holding window and execution pace.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/74 sm:text-base">
            Each mode seeds a starter metric stack and reconfigures your decision cadence so risk, evidence, and trade speed stay aligned from the first session.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {MODES.map((item) => {
            const preset = MODE_PRESETS[item.mode];
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => onSelectMode(item.mode)}
                className="fin-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_55px_-34px_rgba(15,23,42,0.28)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="fin-kicker">{item.icon} Workflow</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-tds-text">{item.label}</h3>
                  </div>
                  <span className="fin-chip">{preset.f.length}F / {preset.t.length}T</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-tds-dim">{item.description}</p>
                <div className="mt-4 fin-divider" />
                <p className="mt-4 text-xs uppercase tracking-[0.16em] text-tds-dim">Tap to activate</p>
              </button>
            );
          })}
        </div>

        {hasExistingMode ? (
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={onCancel} className="rounded-2xl border border-white/80 bg-white/82 px-4 py-2.5 text-sm font-semibold text-tds-dim shadow-sm hover:bg-white hover:text-tds-text">
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
