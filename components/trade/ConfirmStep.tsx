"use client";

import { Button } from "@/components/ui/button";
import type { ConvictionTier, Position, TradeThesis } from "@/types/trade";

type ConfirmStepProps = {
  thesis: TradeThesis;
  conviction: ConvictionTier;
  position: Position;
  entryPrice: number;
  stopLoss: number;
  currentHeat: number;
  deployError: string | null;
  deploying: boolean;
  onBack: () => void;
  onDeploy: () => void;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function ConfirmStep({
  thesis,
  conviction,
  position,
  entryPrice,
  stopLoss,
  currentHeat,
  deploying,
  deployError,
  onBack,
  onDeploy,
}: ConfirmStepProps) {
  const projectedHeat = currentHeat + conviction.risk * 100;
  const heatExceeded = projectedHeat > 12;

  return (
    <div className="space-y-6">
      <div>
        <p className="fin-kicker">Step 4</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-tds-text">Confirm deployment</h2>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="fin-chip font-mono text-tds-text">{thesis.ticker}</span>
        <span className="fin-chip">{thesis.direction}</span>
        <span className="fin-chip">{thesis.assetClass}</span>
        <span className="fin-chip">{conviction.tier}</span>
        {thesis.setupTypes.map((setup) => (
          <span key={setup} className="fin-chip">
            {setup}
          </span>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="fin-card p-5 text-sm text-tds-dim">
          <p className="mb-2 font-mono text-xs text-tds-text">Parameters</p>
          <p>Ticker: {thesis.ticker}</p>
          <p>Conviction: {conviction.tier}</p>
          <p>Risk: {(conviction.risk * 100).toFixed(0)}%</p>
          <p>Entry: {money(entryPrice)}</p>
          <p>Stop: {money(stopLoss)}</p>
          <p>Shares: {position.shares}</p>
        </div>
        <div className="fin-card p-5 text-sm text-tds-dim">
          <p className="mb-2 font-mono text-xs text-tds-text">Exit Plan</p>
          <p>T1 (60%): {position.tranche1} shares</p>
          <p>T2 (40%): {position.tranche2} shares</p>
          <p>2R Target: {money(position.r2Target)}</p>
          <p>4R Target: {money(position.r4Target)}</p>
          <p>Time Stop: Review by catalyst window</p>
        </div>
      </div>

      <div className="fin-card p-5 text-sm text-tds-dim">
        Portfolio heat: <span className="font-mono text-tds-text">{currentHeat.toFixed(2)}%</span> + this trade ({(conviction.risk * 100).toFixed(2)}%) = <span className="font-mono text-tds-text">{projectedHeat.toFixed(2)}%</span>
      </div>

      {heatExceeded ? (
        <div className="rounded-[22px] border border-tds-amber/20 bg-tds-amber/10 p-4 text-sm text-tds-text">
          Heat warning: projected heat exceeds 12%.
        </div>
      ) : null}

      {deployError ? <p className="text-sm text-tds-red">{deployError}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          ← Back
        </Button>
        <Button type="button" onClick={onDeploy} disabled={deploying}>
          {deploying ? "Deploying..." : "Deploy Trade"}
        </Button>
      </div>
    </div>
  );
}