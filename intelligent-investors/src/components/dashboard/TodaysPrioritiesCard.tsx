import * as React from 'react';
import { Trade, WatchlistItem } from '../../lib/types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Target, Clock, ArrowRight } from 'lucide-react';

interface TodaysPrioritiesCardProps {
  trades: Trade[];
  watchlist: WatchlistItem[];
}

export function TodaysPrioritiesCard({ trades, watchlist }: TodaysPrioritiesCardProps) {
  const navigate = useNavigate();

  // Logic to determine priorities
  const activeTrades = trades.filter(t => t.status === 'ACTIVE');
  const staleWatchlist = watchlist.filter(item => {
    if (!item.lastScoredAt) return true;
    const lastScored = new Date(item.lastScoredAt.seconds * 1000);
    const hoursSinceScored = (Date.now() - lastScored.getTime()) / (1000 * 60 * 60);
    return hoursSinceScored > 24; // Stale after 24 hours
  });

  const priorities = [
    ...activeTrades.map(t => ({
      id: t.id,
      type: 'REASSESS',
      title: `Reassess ${t.symbol}`,
      desc: 'Thesis needs audit against current market.',
      icon: Clock,
      color: 'text-blue-500',
      action: () => navigate(`/trade/${t.id}`)
    })),
    ...staleWatchlist.map(item => ({
      id: item.id,
      type: 'RESCORE',
      title: `Rescore ${item.ticker}`,
      desc: 'Watchlist item is stale and needs a fresh AI score.',
      icon: AlertCircle,
      color: 'text-orange-500',
      action: () => navigate('/marketwatch')
    }))
  ].slice(0, 3); // Top 3 priorities

  return (
    <Card className="bg-white border-[var(--line)]">
      <CardHeader className="p-4 border-b border-[var(--line)]">
        <h4 className="col-header flex items-center gap-2">
          <Target size={14} className="text-[var(--ink)]" /> Today's Priorities
        </h4>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-[var(--line)]">
          {priorities.length > 0 ? (
            priorities.map((priority) => (
              <div key={priority.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                <div className={`p-2 rounded-lg bg-gray-100 ${priority.color}`}>
                  <priority.icon size={16} />
                </div>
                <div className="flex-1">
                  <h5 className="font-bold text-sm mb-0.5">{priority.title}</h5>
                  <p className="text-xs opacity-50 leading-relaxed mb-2">{priority.desc}</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-0 h-auto text-[10px] font-mono uppercase tracking-widest gap-2 hover:bg-transparent"
                    onClick={priority.action}
                  >
                    TAKE ACTION <ArrowRight size={10} />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <p className="text-xs opacity-40 font-mono italic">No immediate priorities. Scan MarketWatch for new ideas.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
