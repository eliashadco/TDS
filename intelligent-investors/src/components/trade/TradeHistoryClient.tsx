import * as React from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Trade, TradeStatus, Direction } from '../../lib/types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Search, Filter, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, cn } from '../../lib/utils';

import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export function TradeHistoryClient() {
  const { profile } = useWorkspace();
  const navigate = useNavigate();
  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<TradeStatus | 'ALL'>('ALL');
  const [directionFilter, setDirectionFilter] = React.useState<Direction | 'ALL'>('ALL');

  React.useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'trades'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trades');
    });

    return unsubscribe;
  }, [profile]);

  const filteredTrades = trades.filter(t => {
    const matchesSearch = t.symbol.toLowerCase().includes(search.toLowerCase()) || 
                         t.thesis.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesDirection = directionFilter === 'ALL' || t.direction === directionFilter;
    return matchesSearch && matchesStatus && matchesDirection;
  });

  if (loading) return <div className="p-12 font-mono text-xs opacity-50">Loading trade history...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-serif italic text-4xl">Trade Archive</h2>
          <p className="text-sm opacity-50 mt-1">Full history of your {profile?.mode} lane operations.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={16} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search symbol or thesis..."
              className="pl-10 w-64 h-10 text-xs"
            />
          </div>
          <select 
            className="h-10 bg-white border border-[var(--line)] px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="ALL">All Status</option>
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </select>
          <select 
            className="h-10 bg-white border border-[var(--line)] px-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as any)}
          >
            <option value="ALL">All Directions</option>
            <option value="LONG">Long Only</option>
            <option value="SHORT">Short Only</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredTrades.length > 0 ? (
          filteredTrades.map((trade) => (
            <Card 
              key={trade.id} 
              className="hover:border-[var(--ink)] transition-all cursor-pointer group"
              onClick={() => navigate(`/trade/${trade.id}`)}
            >
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className={cn(
                    "w-12 h-12 flex items-center justify-center font-mono font-bold border",
                    trade.direction === 'LONG' ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
                  )}>
                    {trade.symbol}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-serif italic text-xl">{trade.symbol}</span>
                      <Badge variant={trade.status === 'ACTIVE' ? 'success' : 'neutral'}>{trade.status}</Badge>
                      {trade.direction === 'LONG' ? <ArrowUpRight size={14} className="text-green-600" /> : <ArrowDownRight size={14} className="text-red-600" />}
                    </div>
                    <p className="text-xs opacity-50 line-clamp-1 max-w-md italic">"{trade.thesis}"</p>
                  </div>
                </div>

                <div className="flex items-center gap-12">
                  <div className="text-right">
                    <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Conviction</p>
                    <p className="font-mono text-sm font-bold">{trade.conviction}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Outcome</p>
                    {trade.status === 'CLOSED' && trade.outcome ? (
                      <p className={cn(
                        "font-mono text-sm font-bold",
                        trade.outcome.pnl >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {trade.outcome.rMultiple.toFixed(2)}R
                      </p>
                    ) : (
                      <p className="font-mono text-sm opacity-30">—</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Date</p>
                    <p className="font-mono text-[10px] opacity-50">
                      {new Date(trade.createdAt?.seconds * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-[var(--line)] rounded-xl opacity-40">
            <Clock size={48} className="mb-4" />
            <p className="font-serif italic text-xl">No trades found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
