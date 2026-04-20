import { Trade } from '../../lib/types';
import { getPortfolioHeat } from '../../lib/scoring';
import { cn } from '../../lib/utils';

export function PortfolioHeatCard({ trades, equity }: { trades: Trade[]; equity: number }) {
  const activeWithRisk = trades.map(t => ({
    riskAmount: t.positionSize * Math.abs((t.entryPrice || 0) - (t.stopLoss || 0))
  }));
  
  const heat = getPortfolioHeat(activeWithRisk, equity);
  const heatPercent = heat * 100;

  return (
    <div className="text-right border-r border-[var(--line)] pr-4">
      <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Portfolio Heat</p>
      <p className={cn(
        'font-mono text-xl font-bold',
        heatPercent > 5 ? 'text-red-600' : heatPercent > 3 ? 'text-yellow-600' : 'text-green-600'
      )}>
        {heatPercent.toFixed(2)}%
      </p>
    </div>
  );
}
