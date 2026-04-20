import * as React from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Trade, WatchlistItem } from '../../lib/types';
import { ActivePositionsCard } from './ActivePositionsCard';
import { PortfolioHeatCard } from './PortfolioHeatCard';
import { ReadyTradesCard } from './ReadyTradesCard';
import { TodaysPrioritiesCard } from './TodaysPrioritiesCard';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';

import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export function DashboardClient() {
  const navigate = useNavigate();
  const { profile } = useWorkspace();
  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [watchlist, setWatchlist] = React.useState<WatchlistItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!profile) return;

    const tradesQ = query(
      collection(db, 'trades'),
      where('userId', '==', profile.uid),
      where('mode', '==', profile.mode),
      orderBy('createdAt', 'desc')
    );

    const watchlistQ = query(
      collection(db, 'watchlist_items'),
      where('userId', '==', profile.uid),
      where('mode', '==', profile.mode),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribeTrades = onSnapshot(tradesQ, (snapshot) => {
      const tradeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
      setTrades(tradeData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trades');
    });

    const unsubscribeWatchlist = onSnapshot(watchlistQ, (snapshot) => {
      const watchlistData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WatchlistItem));
      setWatchlist(watchlistData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'watchlist_items');
    });

    return () => {
      unsubscribeTrades();
      unsubscribeWatchlist();
    };
  }, [profile]);

  const activeTrades = trades.filter(t => t.status === 'ACTIVE');

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-serif italic text-4xl">Portfolio Command</h2>
          <p className="text-sm opacity-50 mt-1">Daily operating brief for {profile?.mode} lane.</p>
        </div>
        <div className="flex gap-4">
          <PortfolioHeatCard trades={activeTrades} equity={profile?.equity || 0} />
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Active Trades</p>
            <p className="font-mono text-xl font-bold">{activeTrades.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <ActivePositionsCard trades={activeTrades} />
          <ReadyTradesCard trades={trades} />
        </div>

        <div className="space-y-8">
          <TodaysPrioritiesCard trades={trades} watchlist={watchlist} />
          
          <section>
            <h3 className="font-serif italic text-xl mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start font-mono text-[10px] uppercase tracking-widest"
                onClick={() => navigate('/trade/new')}
              >
                + NEW THESIS
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start font-mono text-[10px] uppercase tracking-widest"
                onClick={() => navigate('/marketwatch')}
              >
                + SCAN MARKETWATCH
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
