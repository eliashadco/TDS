import * as React from 'react';
import { WatchlistItem } from '../../lib/types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatPercent, cn } from '../../lib/utils';
import { Trash2, TrendingUp, TrendingDown, Eye, CheckCircle2, AlertCircle, Zap, Shield, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ScoredList({ items, onRemove, onPreview }: { items: WatchlistItem[]; onRemove: (id: string) => void; onPreview: (t: string) => void }) {
  const scoredItems = items.filter(i => i.status === 'SCORED');
  const watchItems = items.filter(i => i.status === 'WATCH');

  return (
    <div className="space-y-12">
      {/* Scored Workbench */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-serif italic text-2xl">Scored Workbench</h3>
          <Badge variant="outline" className="font-mono text-[10px]">{scoredItems.length} ITEMS READY</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {scoredItems.length === 0 ? (
              <div className="md:col-span-2 p-12 text-center border border-dashed border-[var(--line)] rounded-xl opacity-30 italic font-serif">
                No scored items in workbench. Use the preview drawer to score a ticker.
              </div>
            ) : (
              scoredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative bg-white border border-[var(--line)] rounded-xl overflow-hidden hover:shadow-xl transition-all"
                >
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="font-mono font-bold text-2xl tracking-tighter">{item.ticker}</div>
                        <Badge
                          className={cn(
                            'text-[10px] px-2 py-0.5',
                            item.direction === 'LONG' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          )}
                        >
                          {item.direction}
                        </Badge>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onPreview(item.ticker)} className="p-2 hover:bg-gray-100 rounded-full">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => onRemove(item.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-full">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="col-header mb-1">Verdict</div>
                        <div className={cn(
                          'font-mono font-bold text-sm',
                          item.verdict === 'GO' ? 'text-green-600' :
                          item.verdict === 'CAUTION' ? 'text-yellow-600' :
                          'text-red-600'
                        )}>
                          {item.verdict}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="col-header mb-1">Conviction</div>
                        <div className="font-mono text-sm">{item.conviction || 'TBD'}</div>
                      </div>
                      <div className="flex-1">
                        <div className="col-header mb-1">Score</div>
                        <div className="font-mono text-sm">
                          {item.scores ? Object.values(item.scores.metrics).filter(m => m.passed).length : 0} / {item.scores ? Object.keys(item.scores.metrics).length : 0}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg border border-[var(--line)]">
                      <p className="text-xs opacity-60 line-clamp-2 font-mono leading-relaxed">
                        {item.note || 'No thesis provided.'}
                      </p>
                    </div>

                    <Button
                      className="w-full h-10 text-sm font-serif italic"
                      onClick={() => {
                        window.location.href = `/trades/new?ticker=${item.ticker}&direction=${item.direction}&watchlistId=${item.id}`;
                      }}
                    >
                      Deploy to Trade
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Simple Watchlist */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-serif italic text-2xl">Watchlist</h3>
          <Badge variant="outline" className="font-mono text-[10px]">{watchItems.length} STAGED</Badge>
        </div>

        <div className="bg-white border border-[var(--line)] rounded-xl overflow-hidden">
          <div className="grid grid-cols-[120px_1fr_120px_120px] p-4 border-b border-[var(--line)] bg-gray-50">
            <span className="col-header">Ticker</span>
            <span className="col-header">Status</span>
            <span className="col-header text-right">Added</span>
            <span className="col-header text-right">Action</span>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {watchItems.length === 0 ? (
              <div className="p-12 text-center opacity-30 italic font-serif">
                No staged tickers. Add from Movers or Import.
              </div>
            ) : (
              watchItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[120px_1fr_120px_120px] p-4 items-center hover:bg-gray-50 transition-colors group">
                  <div className="font-mono font-bold text-lg">{item.ticker}</div>
                  <div>
                    <Badge variant="outline" className="text-[10px] opacity-60">STAGED</Badge>
                  </div>
                  <div className="font-mono text-[10px] text-right opacity-40">
                    {new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onPreview(item.ticker)}
                      className="p-2 text-gray-400 hover:text-[var(--ink)] transition-colors"
                      title="Score Ticker"
                    >
                      <Zap size={16} />
                    </button>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
