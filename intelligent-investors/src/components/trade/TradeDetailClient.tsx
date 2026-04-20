import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Trade } from '../../lib/types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { formatCurrency, cn } from '../../lib/utils';
import { CheckCircle2, XCircle, AlertCircle, TrendingUp, TrendingDown, Clock, Zap, RefreshCw } from 'lucide-react';
import { PriceChart } from './PriceChart';
import { TradeReassessmentCard } from './TradeReassessmentCard';
import { AssessmentMatrix } from './AssessmentMatrix';

import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

import { calculateATR, calculateChandelierExit } from '../../lib/market';

export function TradeDetailClient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trade, setTrade] = React.useState<Trade | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [journalEntry, setJournalEntry] = React.useState('');
  const [journalType, setJournalType] = React.useState<'NOTE' | 'REASSESSMENT' | 'EXIT_REVIEW'>('NOTE');
  const [marketPrice, setMarketPrice] = React.useState(0);
  const [atr, setAtr] = React.useState(0);
  const [highSinceEntry, setHighSinceEntry] = React.useState(0);
  const [lowSinceEntry, setLowSinceEntry] = React.useState(0);

  React.useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'trades', id), (snapshot) => {
      if (snapshot.exists()) {
        const data = { id: snapshot.id, ...snapshot.data() } as Trade;
        setTrade(data);
        
        // Fetch market data for ATR and Chandelier
        fetchMarketData(data.symbol);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `trades/${id}`);
    });
    return unsubscribe;
  }, [id]);

  const fetchMarketData = async (symbol: string) => {
    try {
      const [quoteRes, candlesRes] = await Promise.all([
        fetch(`/api/market/quote?ticker=${symbol}`),
        fetch(`/api/market/candles?ticker=${symbol}`)
      ]);
      const quote = await quoteRes.json();
      const candles = await candlesRes.json();
      
      setMarketPrice(quote.price);
      setAtr(calculateATR(candles));
      
      // In a real app, we'd track the highest high / lowest low since entry in Firestore
      // For now, we'll mock it based on current price
      setHighSinceEntry(prev => Math.max(prev, quote.price));
      setLowSinceEntry(prev => prev === 0 ? quote.price : Math.min(prev, quote.price));
    } catch (error) {
      console.error("Market data fetch failed:", error);
    }
  };

  const chandelierStop = React.useMemo(() => {
    if (!trade || !atr) return 0;
    return calculateChandelierExit(
      highSinceEntry || marketPrice,
      lowSinceEntry || marketPrice,
      atr,
      trade.direction
    );
  }, [trade, atr, highSinceEntry, lowSinceEntry, marketPrice]);

  const exitTranches = React.useMemo(() => {
    if (!trade || !trade.entryPrice || !trade.stopLoss) return [];
    const risk = Math.abs(trade.entryPrice - trade.stopLoss);
    return [
      { id: 'E1', label: 'Tranche 1 (25%)', target: trade.direction === 'LONG' ? trade.entryPrice + risk * 2 : trade.entryPrice - risk * 2, status: trade.trancheStatus?.t1Exited ? 'CLOSED' : 'PENDING' },
      { id: 'E2', label: 'Tranche 2 (25%)', target: trade.direction === 'LONG' ? trade.entryPrice + risk * 4 : trade.entryPrice - risk * 4, status: trade.trancheStatus?.t2Exited ? 'CLOSED' : 'PENDING' },
      { id: 'E3', label: 'Tranche 3 (50%)', target: 'Trailing Stop', status: trade.trancheStatus?.t3Exited ? 'CLOSED' : 'PENDING' },
    ];
  }, [trade]);

  const handleStatusChange = async (status: Trade['status']) => {
    if (!id) return;
    await updateDoc(doc(db, 'trades', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  };

  const addJournal = async () => {
    if (!id || !trade || !journalEntry) return;
    const newJournal = {
      timestamp: new Date(),
      content: journalEntry,
      type: journalType,
    };
    await updateDoc(doc(db, 'trades', id), {
      journals: [...(trade.journals || []), newJournal],
      updatedAt: serverTimestamp(),
    });
    setJournalEntry('');
    setJournalType('NOTE');
  };

  const [isClosing, setIsClosing] = React.useState(false);
  const [exitPrice, setExitPrice] = React.useState('');

  const handleCloseTrade = async () => {
    if (!id || !trade || !exitPrice) return;
    const price = Number(exitPrice);
    const entry = trade.entryPrice || 0;
    const stop = trade.stopLoss || 0;
    const risk = Math.abs(entry - stop);
    
    const pnl = trade.direction === 'LONG' 
      ? (price - entry) * trade.positionSize
      : (entry - price) * trade.positionSize;
    
    const rMultiple = risk > 0 ? pnl / (risk * trade.positionSize) : 0;

    await updateDoc(doc(db, 'trades', id), {
      status: 'CLOSED',
      outcome: {
        exitPrice: price,
        exitTimestamp: serverTimestamp(),
        pnl,
        rMultiple
      },
      updatedAt: serverTimestamp(),
    });
    setIsClosing(false);
  };

  if (loading) return <div>Loading trade details...</div>;
  if (!trade) return <div>Trade not found.</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center font-mono text-2xl font-bold border border-[var(--line)]">
            {trade.symbol}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-serif italic text-4xl">{trade.symbol}</h2>
              <Badge variant={trade.direction === 'LONG' ? 'success' : 'error'}>{trade.direction}</Badge>
              <Badge variant="neutral">{trade.mode}</Badge>
            </div>
            <p className="text-sm opacity-50 mt-1">Created on {new Date(trade.createdAt?.seconds * 1000).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-4">
          {trade.status === 'PLANNING' && (
            <Button onClick={() => handleStatusChange('ACTIVE')} className="px-8">Execute Trade</Button>
          )}
          {trade.status === 'ACTIVE' && (
            <Button 
              variant="outline" 
              onClick={() => setIsClosing(true)} 
              className="px-8 text-red-600 border-red-200 hover:bg-red-50"
            >
              Close Position
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>Back</Button>
        </div>
      </div>

      {isClosing && (
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="p-6 flex items-end gap-6">
            <div className="flex-1 space-y-2">
              <label className="text-[10px] font-mono uppercase opacity-50">Exit Price ($)</label>
              <Input 
                type="number" 
                value={exitPrice} 
                onChange={(e) => setExitPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCloseTrade} disabled={!exitPrice}>Confirm Close</Button>
              <Button variant="ghost" onClick={() => setIsClosing(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {trade.status === 'CLOSED' && trade.outcome && (
        <Card className="bg-[var(--ink)] text-[var(--bg)]">
          <CardContent className="p-8 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Realized PnL</p>
              <p className={cn(
                'font-serif italic text-3xl',
                trade.outcome.pnl >= 0 ? 'text-green-400' : 'text-red-400'
              )}>
                {formatCurrency(trade.outcome.pnl)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">R-Multiple</p>
              <p className="font-mono text-3xl font-bold">{trade.outcome.rMultiple.toFixed(2)}R</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Exit Price</p>
              <p className="font-mono text-xl">{formatCurrency(trade.outcome.exitPrice)}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Exit Date</p>
              <p className="font-mono text-sm opacity-60">
                {new Date(trade.outcome.exitTimestamp?.seconds * 1000).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <h3 className="font-serif italic text-xl">Market Context</h3>
            </CardHeader>
            <CardContent className="h-96 p-0">
              <PriceChart symbol={trade.symbol} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-serif italic text-xl">The Thesis</h3>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm leading-relaxed whitespace-pre-wrap italic opacity-80">
                "{trade.thesis}"
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-serif italic text-xl">Journal & Accountability</h3>
                {trade.status === 'CLOSED' && !trade.journals?.some(j => j.type === 'EXIT_REVIEW') && (
                  <Badge variant="error" className="animate-pulse">DUE: Post-Trade Review</Badge>
                )}
              </div>
              <Clock size={16} className="opacity-30" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {trade.journals?.map((j, i) => (
                  <div key={i} className={cn(
                    'p-4 border-l-2',
                    j.type === 'SYSTEM' ? 'border-blue-200 bg-blue-50/30' : 
                    j.type === 'EXIT_REVIEW' ? 'border-green-200 bg-green-50/30' :
                    'border-[var(--line)] bg-gray-50'
                  )}>
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[10px] font-mono uppercase opacity-50">
                        {new Date(j.timestamp?.seconds * 1000 || j.timestamp).toLocaleString()}
                      </p>
                      <Badge variant="neutral" className="text-[8px] h-4">{j.type}</Badge>
                    </div>
                    <p className="text-sm font-mono">{j.content}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-4 pt-4 border-t border-[var(--line)]">
                <div className="flex gap-2">
                  <select 
                    className="h-10 bg-white border border-[var(--line)] px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
                    value={journalType}
                    onChange={(e) => setJournalType(e.target.value as any)}
                  >
                    <option value="NOTE">General Note</option>
                    <option value="REASSESSMENT">Active Reassessment</option>
                    <option value="EXIT_REVIEW">Post-Trade Review</option>
                  </select>
                  <Input
                    value={journalEntry}
                    onChange={(e) => setJournalEntry(e.target.value)}
                    placeholder="Add a journal entry..."
                    onKeyDown={(e) => e.key === 'Enter' && addJournal()}
                    className="flex-1"
                  />
                  <Button variant="secondary" onClick={addJournal}>Add</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {trade.status === 'ACTIVE' && trade.strategySnapshot && (
            <TradeReassessmentCard trade={trade} strategy={trade.strategySnapshot} />
          )}

          <Card>
            <CardHeader>
              <h3 className="font-serif italic text-xl">Mechanical Exit Plan</h3>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-[var(--ink)] text-[var(--bg)]">
                <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Chandelier Exit (3x ATR)</p>
                <p className="font-mono text-xl font-bold">{chandelierStop ? formatCurrency(chandelierStop) : 'Calculating...'}</p>
                <p className="text-[10px] opacity-50 mt-1">Trailing stop based on highest high since entry.</p>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Profit-Taking Tranches</p>
                {exitTranches.map(t => (
                  <div key={t.id} className={cn(
                    "p-3 border flex justify-between items-center",
                    t.status === 'CLOSED' ? "bg-gray-50 border-gray-200 opacity-50" : "bg-white border-[var(--line)]"
                  )}>
                    <div>
                      <p className="text-[10px] font-bold">{t.label}</p>
                      <p className="text-xs font-mono">{typeof t.target === 'number' ? formatCurrency(t.target) : t.target}</p>
                    </div>
                    <Badge variant={t.status === 'CLOSED' ? 'neutral' : 'outline'}>{t.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-serif italic text-xl">Execution Details</h3>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Status</p>
                  <Badge variant={trade.status === 'ACTIVE' ? 'success' : 'neutral'}>{trade.status}</Badge>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Conviction</p>
                  <p className="font-mono text-sm font-bold">{trade.conviction}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Entry</p>
                  <p className="font-mono text-sm">{trade.entryPrice ? formatCurrency(trade.entryPrice) : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Size</p>
                  <p className="font-mono text-sm">{trade.positionSize} Shares</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Stop Loss</p>
                  <p className="font-mono text-sm text-red-600">{trade.stopLoss ? formatCurrency(trade.stopLoss) : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Target</p>
                  <p className="font-mono text-sm text-green-600">{trade.takeProfit ? formatCurrency(trade.takeProfit) : '—'}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-[var(--line)]">
                <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Total Risk</p>
                <p className="font-mono text-xl font-bold">
                  {trade.entryPrice && trade.stopLoss ? formatCurrency(trade.positionSize * Math.abs(trade.entryPrice - trade.stopLoss)) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-serif italic text-xl">Original AI Assessment</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                {trade.assessment?.verdict === 'PASS' && <CheckCircle2 className="text-green-600" size={20} />}
                {trade.assessment?.verdict === 'FAIL' && <XCircle className="text-red-600" size={20} />}
                {trade.assessment?.verdict === 'CAUTION' && <AlertCircle className="text-yellow-600" size={20} />}
                <span className="font-serif italic text-xl">{trade.assessment?.verdict}</span>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Edge</p>
                  <p className="text-xs italic bg-green-50 p-3 border border-green-100">{trade.assessment?.edge}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Risks</p>
                  <p className="text-xs italic bg-red-50 p-3 border border-red-100">{trade.assessment?.risks}</p>
                </div>
                {trade.strategySnapshot && (
                  <div className="pt-4 border-t border-[var(--line)]">
                    <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-2">Matrix</p>
                    <AssessmentMatrix 
                      assessment={trade.assessment!} 
                      strategy={trade.strategySnapshot} 
                      fundamentalScore={trade.fundamentalScore}
                      technicalScore={trade.technicalScore}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
