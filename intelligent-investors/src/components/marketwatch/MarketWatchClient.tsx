import * as React from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useWorkspace } from '../../hooks/useWorkspace';
import { WatchlistItem, TradingMode, Strategy } from '../../lib/types';
import { MoversTable } from './MoversTable';
import { InstrumentPreviewDrawer } from './InstrumentPreviewDrawer';
import { ScoredList } from './ScoredList';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Search, RefreshCw, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export function MarketWatchClient() {
  const { profile } = useWorkspace();
  const [watchlist, setWatchlist] = React.useState<WatchlistItem[]>([]);
  const [movers, setMovers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [previewTicker, setPreviewTicker] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'watchlist_items'),
      where('userId', '==', profile.uid),
      where('mode', '==', profile.mode),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WatchlistItem));
      setWatchlist(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'watchlist_items');
    });

    fetchMovers();

    return unsubscribe;
  }, [profile]);

  const fetchMovers = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/market/premarket?limit=18');
      const data = await response.json();
      setMovers(data.movers);
    } catch (error) {
      console.error("Failed to fetch movers:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleWatch = async (ticker: string) => {
    if (!profile) return;
    await addDoc(collection(db, 'watchlist_items'), {
      userId: profile.uid,
      ticker: ticker.toUpperCase(),
      mode: profile.mode,
      status: 'WATCH',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const handleRemove = async (id: string) => {
    await deleteDoc(doc(db, 'watchlist_items', id));
  };

  const handleImport = async () => {
    if (!search || !profile) return;
    const tickers = search.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    
    setRefreshing(true);
    try {
      const response = await fetch('/api/market/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers })
      });
      const data = await response.json();
      
      for (const mover of data.movers) {
        await addDoc(collection(db, 'watchlist_items'), {
          userId: profile.uid,
          ticker: mover.ticker,
          mode: profile.mode,
          status: 'WATCH',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setSearch('');
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <div className="p-12 font-mono text-xs opacity-50">Initializing MarketWatch...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-serif italic text-4xl">MarketWatch</h2>
          <p className="text-sm opacity-50 mt-1">Discovery and workbench for {profile?.mode} lane.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Import Tickers (e.g. NVDA, AAPL)"
              className="w-64 h-10 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            />
            <Button variant="secondary" onClick={handleImport}>
              <Plus size={16} />
            </Button>
          </div>
          <Button variant="outline" onClick={fetchMovers} disabled={refreshing}>
            <RefreshCw size={16} className={cn(refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8">
          <MoversTable
            movers={movers}
            onPreview={setPreviewTicker}
            onWatch={handleWatch}
            watchlist={watchlist}
          />
        </div>

        <div className="lg:col-span-8 space-y-8">
          <ScoredList
            items={watchlist.filter(i => i.status === 'SCORED' || i.status === 'WATCH')}
            onRemove={handleRemove}
            onPreview={setPreviewTicker}
          />
        </div>
      </div>

      {previewTicker && (
        <InstrumentPreviewDrawer
          ticker={previewTicker}
          onClose={() => setPreviewTicker(null)}
          onWatch={handleWatch}
          isWatched={watchlist.some(i => i.ticker === previewTicker)}
        />
      )}
    </div>
  );
}
