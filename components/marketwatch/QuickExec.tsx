"use client";

import { Input } from "@/components/ui/input";
import type { ConvictionTier } from "@/types/trade";

type QuickExecProps = {
  entry: number | null;
  stop: number | null;
  equity: number;
  conviction: ConvictionTier | null;
  onEntryChange: (value: number | null) => void;
  onStopChange: (value: number | null) => void;
};

export default function QuickExec({ entry, stop, equity, conviction, onEntryChange, onStopChange }: QuickExecProps) {
  const rPerShare = entry != null && stop != null ? Math.abs(entry - stop) : 0;
  const lockedRisk = conviction ? equity * conviction.risk : 0;
  const shares = conviction && rPerShare > 0 ? Math.floor(lockedRisk / rPerShare) : 0;

  return (
    <div className="rounded-[22px] border border-slate-100 bg-slate-50/80 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          type="number"
          value={entry ?? ""}
          onChange={(event) => onEntryChange(event.target.value ? Number(event.target.value) : null)}
          placeholder="Entry"
        />
        <Input
          type="number"
          value={stop ?? ""}
          onChange={(event) => onStopChange(event.target.value ? Number(event.target.value) : null)}
          placeholder="Stop"
        />
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-tds-dim">
        {conviction ? `Conviction ${conviction.tier} (${(conviction.risk * 100).toFixed(0)}%)` : "Gates not met for conviction sizing"} · Shares: {shares}
      </p>
    </div>
  );
}