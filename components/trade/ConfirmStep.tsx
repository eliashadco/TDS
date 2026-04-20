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
  isOverride?: boolean;
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
  isOverride,
  onBack,
  onDeploy,
}: ConfirmStepProps) {
  const projectedHeat = currentHeat + conviction.risk * 100;
  const heatExceeded = projectedHeat > 12;

  return (
    <div className="space-y-5">
      <div className="trade-step-hero trade-confirm-hero">
        <div className="trade-step-hero-copy">
        <p className="meta-label">Step 4</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-tds-text">Confirm deployment</h2>
          <p>Review only the final execution terms, projected heat, and staged exits before sending the trade live.</p>
        </div>
        <span className="trade-summary-pill">{thesis.ticker}</span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-tag neutral">{thesis.ticker}</span>
        <span className="inline-tag neutral">{thesis.direction}</span>
        <span className="inline-tag neutral">{thesis.assetClass}</span>
        <span className="inline-tag scored">{conviction.tier}</span>
        {thesis.setupTypes.map((setup) => (
          <span key={setup} className="inline-tag neutral">
            {setup}
          </span>
        ))}
      </div>

      <div className="trade-confirm-grid">
        <div className="trade-review-card trade-compact-card trade-confirm-main-card">
          <p className="mb-3 font-mono text-xs text-tds-text">Execution Summary</p>
          <div className="trade-confirm-kpi-grid">
            <article>
              <span>Entry</span>
              <strong>{money(entryPrice)}</strong>
            </article>
            <article>
              <span>Stop</span>
              <strong>{money(stopLoss)}</strong>
            </article>
            <article>
              <span>Shares</span>
              <strong>{position.shares}</strong>
            </article>
            <article>
              <span>Risk</span>
              <strong>{(conviction.risk * 100).toFixed(0)}%</strong>
            </article>
          </div>
          <div className="assessment-list compact trade-confirm-list">
            <div>
              <span>Conviction</span>
              <strong>{conviction.tier}</strong>
            </div>
            <div>
              <span>Asset</span>
              <strong>{thesis.assetClass}</strong>
            </div>
            <div>
              <span>Setup count</span>
              <strong>{thesis.setupTypes.length}</strong>
            </div>
          </div>
        </div>

        <div className="trade-review-card trade-compact-card trade-confirm-side-card">
          <p className="mb-3 font-mono text-xs text-tds-text">Exit Plan</p>
          <div className="assessment-list compact trade-confirm-list">
            <div>
              <span>T1 (60%)</span>
              <strong>{position.tranche1} shares</strong>
            </div>
            <div>
              <span>T2 (40%)</span>
              <strong>{position.tranche2} shares</strong>
            </div>
            <div>
              <span>2R target</span>
              <strong>{money(position.r2Target)}</strong>
            </div>
            <div>
              <span>4R target</span>
              <strong>{money(position.r4Target)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="trade-review-card trade-compact-card text-sm text-tds-dim trade-confirm-heat-card">
        Portfolio heat: <span className="font-mono text-tds-text">{currentHeat.toFixed(2)}%</span> + this trade ({(conviction.risk * 100).toFixed(2)}%) = <span className="font-mono text-tds-text">{projectedHeat.toFixed(2)}%</span>
      </div>

      {isOverride ? (
        <div className="rounded-[22px] border border-tds-amber/20 bg-tds-amber/5 p-4 text-sm text-tds-text">
          <p className="font-semibold text-tds-amber">Override Trade</p>
          <p className="mt-1 text-tds-dim">This trade will be classified as an override and reduce your discipline score.</p>
        </div>
      ) : null}

      {heatExceeded ? (
        <div className="rounded-[22px] border border-tds-amber/20 bg-tds-amber/10 p-4 text-sm text-tds-text">
          Heat warning: projected heat exceeds 12%.
        </div>
      ) : null}

      {deployError ? <p className="text-sm text-tds-red">{deployError}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" className="secondary-button" onClick={onBack}>
          ← Back
        </Button>
        <Button type="button" className="primary-button" onClick={onDeploy} disabled={deploying}>
          {deploying ? "Deploying..." : "Deploy Trade"}
        </Button>
      </div>
    </div>
  );
}