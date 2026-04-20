import * as React from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { TrendingUp, TrendingDown, Eye, Plus, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { WatchlistItem } from '../../lib/types';

interface Mover {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  status: string;
}

export function MoversTable({ movers, onPreview, onWatch, watchlist }: { movers: Mover[]; onPreview: (t: string) => void; onWatch: (t: string) => void; watchlist: WatchlistItem[] }) {
  const [tab, setTab] = React.useState<'ALL' | 'GAINERS' | 'LOSERS'>('ALL');

  const filteredMovers = React.useMemo(() => {
    if (tab === 'GAINERS') return movers.filter(m => m.changePercent > 0);
    if (tab === 'LOSERS') return movers.filter(m => m.changePercent < 0);
    return movers;
  }, [movers, tab]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif italic text-xl">Active Movers</h3>
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
          {(['ALL', 'GAINERS', 'LOSERS'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-1 text-[10px] font-mono uppercase tracking-widest transition-all',
                tab === t ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-gray-500 hover:text-[var(--ink)]'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[var(--line)]">
        <div className="grid grid-cols-[80px_1fr_80px_80px] p-3 border-b border-[var(--line)] bg-gray-50">
          <span className="col-header">Ticker</span>
          <span className="col-header text-right">Price</span>
          <span className="col-header text-right">Change</span>
          <span className="col-header text-right">Action</span>
        </div>
        <div className="divide-y divide-[var(--line)] max-h-[600px] overflow-y-auto">
          {filteredMovers.length === 0 ? (
            <div className="p-12 text-center opacity-30 italic font-serif">
              No movers found in current feed.
            </div>
          ) : (
            filteredMovers.map((mover) => {
              const isPositive = mover.changePercent >= 0;
              const isWatched = watchlist.some(i => i.ticker === mover.ticker);
              return (
                <div key={mover.ticker} className="grid grid-cols-[80px_1fr_80px_80px] p-3 items-center hover:bg-gray-50 transition-colors group">
                  <div className="font-mono font-bold">{mover.ticker}</div>
                  <div className="font-mono text-sm text-right">{formatCurrency(mover.price)}</div>
                  <div className={cn('font-mono text-sm text-right', isPositive ? 'text-green-600' : 'text-red-600')}>
                    {mover.changePercent.toFixed(2)}%
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onPreview(mover.ticker)}
                      className="p-1.5 text-gray-400 hover:text-[var(--ink)] transition-colors"
                      title="Preview"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => !isWatched && onWatch(mover.ticker)}
                      className={cn(
                        'p-1.5 transition-colors',
                        isWatched ? 'text-green-600' : 'text-gray-400 hover:text-[var(--ink)]'
                      )}
                      title={isWatched ? 'Watched' : 'Watch'}
                    >
                      {isWatched ? <Check size={14} /> : <Plus size={14} />}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
