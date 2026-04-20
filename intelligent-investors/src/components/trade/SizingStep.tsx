import * as React from 'react';
import { Trade, UserProfile } from '../../lib/types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { getConviction, calculatePosition, getPortfolioHeat } from '../../lib/scoring';
import { formatCurrency, cn } from '../../lib/utils';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { MAX_PORTFOLIO_HEAT } from '../../lib/constants';
import { AlertTriangle } from 'lucide-react';

import { calculateATR, Candle } from '../../lib/market';

export function SizingStep({ trade, profile, onUpdate, onNext, onBack }: { trade: Trade; profile: UserProfile; onUpdate: (s: Partial<Trade>) => void; onNext: () => void; onBack: () => void }) {
  const conviction = React.useMemo(() => 
    getConviction(trade.assessment!.fundamentalScore, trade.assessment!.technicalScore), 
    [trade.assessment]
  );
  
  const [entry, setEntry] = React.useState(trade.entryPrice || 0);
  const [stop, setStop] = React.useState(trade.stopLoss || 0);
  const [target, setTarget] = React.useState(trade.takeProfit || 0);
  const [currentHeat, setCurrentHeat] = React.useState(0);
  const [atr, setAtr] = React.useState(0);
  const [marketPrice, setMarketPrice] = React.useState(0);
  const [sector, setSector] = React.useState('');
  const [sectorHeat, setSectorHeat] = React.useState(0);

  React.useEffect(() => {
    async function fetchMarketData() {
      try {
        const [quoteRes, candlesRes] = await Promise.all([
          fetch(`/api/market/quote?ticker=${trade.symbol}`),
          fetch(`/api/market/candles?ticker=${trade.symbol}`)
        ]);
        
        const quote = await quoteRes.json();
        const candles = await candlesRes.json();
        
        setMarketPrice(quote.price);
        setSector(quote.sector);
        if (entry === 0) setEntry(Number(quote.price.toFixed(2)));
        
        const calculatedAtr = calculateATR(candles);
        setAtr(calculatedAtr);
        
        if (stop === 0 && calculatedAtr > 0) {
          const initialStop = trade.direction === 'LONG' 
            ? quote.price - (calculatedAtr * 1.5)
            : quote.price + (calculatedAtr * 1.5);
          setStop(Number(initialStop.toFixed(2)));
        }
      } catch (error) {
        console.error("Market data fetch failed:", error);
      }
    }
    fetchMarketData();
  }, [trade.symbol]);

  React.useEffect(() => {
    async function fetchHeat() {
      const q = query(collection(db, 'trades'), where('userId', '==', profile.uid), where('status', '==', 'ACTIVE'));
      const snap = await getDocs(q);
      const activeTrades = snap.docs.map(d => d.data() as Trade);
      
      const totalHeat = getPortfolioHeat(activeTrades.map(t => ({ 
        riskAmount: t.positionSize * Math.abs((t.entryPrice || 0) - (t.stopLoss || 0)) 
      })), profile.equity);
      
      setCurrentHeat(totalHeat);

      if (sector) {
        const sHeat = activeTrades
          .filter(t => t.sector === sector)
          .reduce((sum, t) => sum + (t.positionSize * Math.abs(t.entryPrice! - t.stopLoss!)), 0);
        setSectorHeat(sHeat / profile.equity);
      }
    }
    fetchHeat();
  }, [profile, sector]);

  const size = React.useMemo(() => {
    if (!entry || !stop) return 0;
    return calculatePosition(profile.equity, 0.02, conviction, entry, stop);
  }, [profile, conviction, entry, stop]);

  const riskAmount = size * Math.abs(entry - stop);
  const newHeat = currentHeat + (riskAmount / profile.equity);
  const isHeatExceeded = newHeat > MAX_PORTFOLIO_HEAT;
  const isSectorConcentrated = (sectorHeat + (riskAmount / profile.equity)) > 0.25;
  const rewardAmount = size * Math.abs(target - entry);
  const rRatio = riskAmount > 0 ? rewardAmount / riskAmount : 0;

  const tranches = React.useMemo(() => {
    if (!size || !entry || !stop) return [];
    const unitRisk = Math.abs(entry - stop);
    return [
      { id: 'T1', label: 'Tranche 1 (60%)', shares: Math.floor(size * 0.6), price: entry, target: entry + (unitRisk * 2), trigger: 'Market Entry' },
      { id: 'T2', label: 'Tranche 2 (40%)', shares: Math.floor(size * 0.4), price: entry, target: entry + (unitRisk * 4), trigger: 'Pullback / 10-Day Rule' },
    ];
  }, [size, entry, stop]);

  const handleNext = () => {
    onUpdate({
      conviction,
      positionSize: size,
      entryPrice: entry,
      stopLoss: stop,
      takeProfit: target,
      fundamentalScore: trade.assessment?.fundamentalScore,
      technicalScore: trade.assessment?.technicalScore,
      trancheStatus: {
        t1Entered: false,
        t2Entered: false,
        t1Exited: false,
        t2Exited: false,
        t3Exited: false
      },
      tranches: tranches.map(t => ({
        id: t.id,
        shares: t.shares,
        entryPrice: t.price,
        targetPrice: t.target,
        status: 'PENDING'
      }))
    });
    onNext();
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border border-[var(--line)] bg-white">
          <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Conviction Tier</p>
          <div className="flex items-center gap-2">
            <span className="font-serif italic text-xl">{conviction}</span>
            <Badge variant="outline">
              {conviction === 'STANDARD' ? '2% Risk' : conviction === 'HIGH' ? '3% Risk' : conviction === 'MAXIMUM' ? '4% Risk' : '0% Risk'}
            </Badge>
          </div>
        </div>
        <div className="p-4 border border-[var(--line)] bg-white">
          <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Risk Unit (1R)</p>
          <p className="font-mono text-xl font-bold">{formatCurrency(profile.equity * 0.02)}</p>
        </div>
        <div className="p-4 border border-[var(--line)] bg-white">
          <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Max Position Size</p>
          <p className="font-mono text-xl font-bold">{size} Shares</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">Entry Price</label>
          <Input
            type="number"
            value={entry || ''}
            onChange={(e) => setEntry(Number(e.target.value))}
            placeholder="0.00"
            className="text-xl font-bold"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">Stop Loss</label>
          <Input
            type="number"
            value={stop || ''}
            onChange={(e) => setStop(Number(e.target.value))}
            placeholder="0.00"
            className="text-xl font-bold text-red-600"
          />
          {atr > 0 && (
            <p className="text-[10px] font-mono opacity-50 mt-1">
              ATR(14): {atr.toFixed(2)} • 1.5x ATR Stop: {trade.direction === 'LONG' ? (marketPrice - atr * 1.5).toFixed(2) : (marketPrice + atr * 1.5).toFixed(2)}
            </p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase opacity-50 mb-1 tracking-widest">Take Profit</label>
          <Input
            type="number"
            value={target || ''}
            onChange={(e) => setTarget(Number(e.target.value))}
            placeholder="0.00"
            className="text-xl font-bold text-green-600"
          />
        </div>
      </div>

      <div className="p-6 bg-[var(--ink)] text-[var(--bg)] space-y-4">
        <div className="flex justify-between items-end border-b border-[var(--bg)]/20 pb-4">
          <div>
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Mechanical Sizing</p>
            <p className="text-3xl font-mono font-bold">{size} <span className="text-sm opacity-50 font-normal">SHARES</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Total Risk</p>
            <p className="text-xl font-mono">{formatCurrency(riskAmount)}</p>
          </div>
        </div>
        
        {tranches.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Tranche Execution Plan</p>
            <div className="grid grid-cols-2 gap-4">
              {tranches.map(t => (
                <div key={t.id} className="p-3 bg-white/5 border border-white/10 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold">{t.label}</span>
                    <span className="text-[10px] opacity-50">{t.shares} SH</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span>Entry: {formatCurrency(t.price)}</span>
                    <span className="text-green-400">Target: {formatCurrency(t.target)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between text-sm font-mono uppercase tracking-widest opacity-70 pt-4 border-t border-white/10">
          <span>R:R Ratio: {rRatio.toFixed(2)}</span>
          <span className={cn(isHeatExceeded && 'text-red-400 font-bold')}>
            Portfolio Heat: {(newHeat * 100).toFixed(2)}%
          </span>
        </div>
      </div>

      {isHeatExceeded && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3 font-mono">
          <AlertTriangle size={20} />
          <div>
            <p className="font-bold uppercase">Portfolio Heat Exceeded</p>
            <p>This trade would bring total risk to {(newHeat * 100).toFixed(2)}%, exceeding your {MAX_PORTFOLIO_HEAT * 100}% limit. Entry blocked.</p>
          </div>
        </div>
      )}

      {isSectorConcentrated && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs flex items-center gap-3 font-mono">
          <AlertTriangle size={20} />
          <div>
            <p className="font-bold uppercase">Sector Concentration Warning</p>
            <p>This trade would put {((sectorHeat + (riskAmount / profile.equity)) * 100).toFixed(2)}% of risk in {sector}. Limit is 25% per sector.</p>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-8 border-t border-[var(--line)]">
        <Button variant="outline" onClick={onBack}>Back to Assessment</Button>
        <Button onClick={handleNext} disabled={!size || !target || isHeatExceeded || isSectorConcentrated}>
          Final Review
        </Button>
      </div>
    </div>
  );
}
