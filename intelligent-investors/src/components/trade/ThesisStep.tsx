import * as React from 'react';
import { Direction, Trade } from '../../lib/types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { LearnOverlay } from '../learn/LearnToggle';
import { SETUP_TYPES, SETUP_CONDITIONS, CHART_PATTERNS } from '../../lib/constants';
import { AlertCircle } from 'lucide-react';

export function ThesisStep({ data, onChange, onNext }: { data: Partial<Trade>; onChange: (d: Partial<Trade>) => void; onNext: () => void }) {
  const [contradiction, setContradiction] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Basic contradiction detection
    if (data.direction === 'LONG' && data.setup?.pattern?.toLowerCase().includes('bear')) {
      setContradiction("Warning: You've selected a Bearish pattern for a LONG trade.");
    } else if (data.direction === 'SHORT' && data.setup?.pattern?.toLowerCase().includes('bull')) {
      setContradiction("Warning: You've selected a Bullish pattern for a SHORT trade.");
    } else {
      setContradiction(null);
    }
  }, [data.direction, data.setup?.pattern]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-8">
        <LearnOverlay title="Ticker Selection" description="TDS forces you to trade a specific instrument. Ensure the ticker is correct and liquid enough for your chosen mode.">
          <div>
            <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">Ticker Symbol</label>
            <Input
              value={data.symbol}
              onChange={(e) => onChange({ symbol: e.target.value.toUpperCase() })}
              placeholder="e.g. NVDA"
              className="text-2xl font-bold h-14"
            />
          </div>
        </LearnOverlay>
        <LearnOverlay title="Direction Awareness" description="Are you betting on growth (Long) or a decline (Short)? TDS requires explicit direction to tailor the AI assessment logic.">
          <div>
            <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">Direction</label>
            <div className="flex gap-2 h-14">
              {(['LONG', 'SHORT'] as Direction[]).map((d) => (
                <button
                  key={d}
                  onClick={() => onChange({ direction: d })}
                  className={cn(
                    'flex-1 font-mono uppercase tracking-widest border transition-all',
                    data.direction === d
                      ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                      : 'bg-white text-[var(--ink)] border-[var(--line)] hover:bg-gray-50'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </LearnOverlay>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">Setup Type</label>
          <select 
            className="w-full h-10 bg-white border border-[var(--line)] px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
            value={data.setup?.type || ''}
            onChange={(e) => onChange({ setup: { ...data.setup!, type: e.target.value } })}
          >
            <option value="">Select Type</option>
            {SETUP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">Condition</label>
          <select 
            className="w-full h-10 bg-white border border-[var(--line)] px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
            value={data.setup?.condition || ''}
            onChange={(e) => onChange({ setup: { ...data.setup!, condition: e.target.value } })}
          >
            <option value="">Select Condition</option>
            {SETUP_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">Pattern</label>
          <select 
            className="w-full h-10 bg-white border border-[var(--line)] px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
            value={data.setup?.pattern || ''}
            onChange={(e) => onChange({ setup: { ...data.setup!, pattern: e.target.value } })}
          >
            <option value="">Select Pattern</option>
            {CHART_PATTERNS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {contradiction && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 font-mono">
          <AlertCircle size={14} />
          {contradiction}
        </div>
      )}

      <div className="grid grid-cols-2 gap-8">
        <LearnOverlay title="Catalyst Window" description="The timeframe in which the thesis should begin to play out. If it doesn't happen by then, the trade is dead.">
          <div>
            <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">Catalyst Window</label>
            <Input
              value={data.catalystWindow}
              onChange={(e) => onChange({ catalystWindow: e.target.value })}
              placeholder="e.g. Next 3 weeks, Post-Earnings"
              className="h-12"
            />
          </div>
        </LearnOverlay>
        <LearnOverlay title="Invalidation Condition" description="The single fundamental condition that makes your thesis WRONG. Not price action, but a logic failure.">
          <div>
            <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">Invalidation Condition</label>
            <Input
              value={data.invalidationCondition}
              onChange={(e) => onChange({ invalidationCondition: e.target.value })}
              placeholder="e.g. Revenue growth < 10%"
              className="h-12"
            />
          </div>
        </LearnOverlay>
      </div>

      <LearnOverlay title="The Thesis Statement" description="This is the core of your trade. Articulate WHY this trade exists. Avoid generic statements; focus on catalysts, technical setups, or fundamental shifts.">
        <div>
          <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">The Thesis (2-3 Sentences)</label>
          <textarea
            value={data.thesis}
            onChange={(e) => onChange({ thesis: e.target.value })}
            placeholder="What is mispriced and why? Be specific."
            className="w-full h-32 bg-white border border-[var(--line)] p-4 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--ink)] resize-none"
          />
        </div>
      </LearnOverlay>

      <div className="flex justify-end">
        <Button
          onClick={onNext}
          disabled={!data.symbol || !data.thesis || !data.catalystWindow || !data.invalidationCondition || !data.setup?.type || !data.setup?.pattern}
          className="px-12 py-4"
        >
          Score Evidence
        </Button>
      </div>
    </div>
  );
}
