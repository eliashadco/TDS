import * as React from 'react';
import { Trade } from '../../lib/types';
import { Button } from '../ui/Button';
import { formatCurrency, cn } from '../../lib/utils';

export function ConfirmStep({ trade, onComplete, onBack }: { trade: Trade; onComplete: (isOverride?: boolean) => void; onBack: () => void }) {
  const [isOverride, setIsOverride] = React.useState(false);
  const [overrideConfirmed, setOverrideConfirmed] = React.useState(false);

  const canProceed = trade.assessment?.verdict === 'PASS' || (isOverride && overrideConfirmed);

  return (
    <div className="space-y-8">
      <div className={cn(
        "p-8 border-2 bg-white space-y-8",
        trade.assessment?.verdict === 'FAIL' ? "border-red-600" : "border-[var(--ink)]"
      )}>
        <div className="flex justify-between items-start border-b border-[var(--line)] pb-6">
          <div>
            <h4 className="font-serif italic text-3xl">{trade.symbol}</h4>
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">{trade.direction} • {trade.mode}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Conviction</p>
            <p className="font-serif italic text-xl">{trade.conviction}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Thesis Summary</p>
              <p className="text-sm italic line-clamp-4">{trade.thesis}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Mechanical Audit</p>
              <div className="flex gap-4">
                <div className="text-xs font-mono">
                  <span className="opacity-50">F:</span> {trade.fundamentalScore}/5
                </div>
                <div className="text-xs font-mono">
                  <span className="opacity-50">T:</span> {trade.technicalScore}/3
                </div>
                <div className="text-xs font-mono font-bold">
                  <span className="opacity-50">VERDICT:</span> {trade.assessment?.verdict}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Entry</p>
                <p className="font-mono font-bold">{formatCurrency(trade.entryPrice!)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Size</p>
                <p className="font-mono font-bold">{trade.positionSize} Shares</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Stop</p>
                <p className="font-mono font-bold text-red-600">{formatCurrency(trade.stopLoss!)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Target</p>
                <p className="font-mono font-bold text-green-600">{formatCurrency(trade.takeProfit!)}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-[var(--line)]">
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Total Risk</p>
              <p className="text-xl font-mono font-bold">{formatCurrency(trade.positionSize * Math.abs(trade.entryPrice! - trade.stopLoss!))}</p>
            </div>
          </div>
        </div>
      </div>

      {trade.assessment?.verdict === 'FAIL' && !isOverride && (
        <div className="p-6 border border-red-200 bg-red-50 space-y-4">
          <p className="text-sm text-red-800 font-bold uppercase tracking-widest">Mechanical Failure</p>
          <p className="text-xs text-red-700">This trade failed the mechanical audit. Entry is blocked to protect your edge. If you believe this is an exceptional case, you may use one of your 2-per-quarter overrides.</p>
          <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white" onClick={() => setIsOverride(true)}>
            Request Discretionary Override
          </Button>
        </div>
      )}

      {isOverride && (
        <div className="p-6 border border-yellow-200 bg-yellow-50 space-y-4">
          <p className="text-sm text-yellow-800 font-bold uppercase tracking-widest">Override Confirmation</p>
          <p className="text-xs text-yellow-700">Using an override consumes 1 unit of your quarterly budget. This trade will be flagged as "Discretionary" in your analytics.</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={overrideConfirmed} 
              onChange={(e) => setOverrideConfirmed(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-xs font-mono">I acknowledge the risk of discretionary deviation.</span>
          </label>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 p-4">
        <p className="text-xs font-mono text-yellow-800">
          <strong>CONTRACT:</strong> By confirming, you agree to respect the mechanical stop and sizing constraints derived from your strategy. Discretionary overrides are disabled once locked.
        </p>
      </div>

      <div className="flex justify-between pt-8 border-t border-[var(--line)]">
        <Button variant="outline" onClick={onBack}>Back to Sizing</Button>
        <Button 
          onClick={() => onComplete(isOverride)} 
          className="px-16 py-4"
          disabled={!canProceed}
        >
          {isOverride ? 'Execute Override' : 'Lock & Execute'}
        </Button>
      </div>
    </div>
  );
}
