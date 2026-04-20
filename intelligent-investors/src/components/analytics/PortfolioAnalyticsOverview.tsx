import * as React from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Trade } from '../../lib/types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import { formatCurrency } from '../../lib/utils';

import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export function PortfolioAnalyticsOverview() {
  const { profile } = useWorkspace();
  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'trades'), where('userId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trades');
    });
    return unsubscribe;
  }, [profile]);

  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const wins = closedTrades.filter(t => (t.outcome?.pnl || 0) > 0);
  const losses = closedTrades.filter(t => (t.outcome?.pnl || 0) <= 0);
  
  const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.outcome?.pnl || 0), 0);
  
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.outcome?.pnl || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.outcome?.pnl || 0), 0) / losses.length) : 0;
  
  const expectancy = closedTrades.length > 0 ? (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss) : 0;
  const profitFactor = avgLoss > 0 ? (wins.reduce((sum, t) => sum + (t.outcome?.pnl || 0), 0)) / (losses.reduce((sum, t) => sum + Math.abs(t.outcome?.pnl || 0), 0)) : 0;
  
  const avgR = closedTrades.length > 0 ? closedTrades.reduce((sum, t) => sum + (t.outcome?.rMultiple || 0), 0) / closedTrades.length : 0;

  const pnlData = closedTrades.map((t, i) => ({
    index: i + 1,
    pnl: t.outcome?.pnl || 0,
    cumulative: closedTrades.slice(0, i + 1).reduce((sum, curr) => sum + (curr.outcome?.pnl || 0), 0)
  }));

  const rollingExpectancy = React.useMemo(() => {
    const windowSize = 5;
    return pnlData.map((d, i) => {
      if (i < windowSize) return { ...d, rolling: null };
      const window = pnlData.slice(i - windowSize, i);
      const winCount = window.filter(w => w.pnl > 0).length;
      const wr = winCount / windowSize;
      const wins = window.filter(w => w.pnl > 0);
      const losses = window.filter(w => w.pnl <= 0);
      const aw = wins.length > 0 ? wins.reduce((s, w) => s + w.pnl, 0) / wins.length : 0;
      const al = losses.length > 0 ? Math.abs(losses.reduce((s, w) => s + w.pnl, 0) / losses.length) : 0;
      return { ...d, rolling: (wr * aw) - ((1 - wr) * al) };
    });
  }, [pnlData]);

  const expectancyDivergence = React.useMemo(() => {
    const systemTrades = closedTrades.filter(t => !t.isOverride);
    const overrideTrades = closedTrades.filter(t => t.isOverride);

    const calcExp = (ts: Trade[]) => {
      if (ts.length === 0) return 0;
      const ws = ts.filter(t => (t.outcome?.pnl || 0) > 0);
      const ls = ts.filter(t => (t.outcome?.pnl || 0) <= 0);
      const wr = ws.length / ts.length;
      const aw = ws.length > 0 ? ws.reduce((s, t) => s + (t.outcome?.pnl || 0), 0) / ws.length : 0;
      const al = ls.length > 0 ? Math.abs(ls.reduce((s, t) => s + (t.outcome?.pnl || 0), 0) / ls.length) : 0;
      return (wr * aw) - ((1 - wr) * al);
    };

    return [
      { name: 'System', expectancy: calcExp(systemTrades), count: systemTrades.length },
      { name: 'Override', expectancy: calcExp(overrideTrades), count: overrideTrades.length },
    ];
  }, [closedTrades]);

  const currentQuarterOverrides = React.useMemo(() => {
    const now = new Date();
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    return trades.filter(t => t.isOverride && t.createdAt?.toDate() >= quarterStart).length;
  }, [trades]);

  const sourceComparison = React.useMemo(() => {
    const sources: Record<string, { pnl: number; count: number }> = {};
    closedTrades.forEach(t => {
      const s = t.source || 'MANUAL';
      if (!sources[s]) sources[s] = { pnl: 0, count: 0 };
      sources[s].pnl += (t.outcome?.pnl || 0);
      sources[s].count += 1;
    });
    return Object.entries(sources).map(([name, data]) => ({ 
      name, 
      pnl: data.pnl,
      avgPnl: data.pnl / data.count
    }));
  }, [closedTrades]);

  const setupBreakdown = React.useMemo(() => {
    const counts: Record<string, number> = {};
    closedTrades.forEach(t => {
      const type = t.setup?.type || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [closedTrades]);

  if (loading) return <div>Loading analytics...</div>;

  return (
    <div className="space-y-10 pb-20">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-serif italic text-4xl">Portfolio Analytics</h2>
          <p className="text-sm opacity-50 mt-1">Performance attribution and mechanical discipline review.</p>
        </div>
        <div className="flex gap-8">
          <div className="text-right p-4 border border-red-200 bg-red-50">
            <p className="text-[10px] font-mono uppercase text-red-600 tracking-widest">Override Budget</p>
            <p className="font-mono text-xl font-bold text-red-700">{currentQuarterOverrides}/2 <span className="text-xs opacity-50">USED</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Expectancy</p>
            <p className="font-mono text-xl font-bold">{formatCurrency(expectancy)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Total P&L</p>
            <p className={`font-mono text-xl font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalPnl)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Win Rate', value: `${winRate.toFixed(1)}%` },
          { label: 'Profit Factor', value: profitFactor.toFixed(2) },
          { label: 'Avg R-Multiple', value: `${avgR.toFixed(2)}R` },
          { label: 'Trade Count', value: closedTrades.length },
        ].map((m, i) => (
          <div key={i} className="p-6 border border-[var(--line)] bg-white">
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">{m.label}</p>
            <p className="font-mono text-2xl font-bold">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-8">
          <CardHeader>
            <h3 className="font-serif italic text-xl">Equity Curve & Rolling Expectancy</h3>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rollingExpectancy}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="index" hide />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontFamily: 'monospace', fontSize: '10px' }} />
                <Line yAxisId="left" type="monotone" dataKey="cumulative" stroke="#141414" strokeWidth={2} dot={false} name="Equity" />
                <Line yAxisId="right" type="monotone" dataKey="rolling" stroke="#3b82f6" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Rolling Exp (5)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <h3 className="font-serif italic text-xl">Expectancy Divergence</h3>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expectancyDivergence}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontFamily: 'monospace', fontSize: '10px' }} />
                <Bar dataKey="expectancy" fill="#141414" name="Expectancy ($)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-12">
          <CardHeader>
            <h3 className="font-serif italic text-xl">Source Comparison</h3>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceComparison}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontFamily: 'monospace', fontSize: '10px' }} />
                <Bar dataKey="avgPnl" fill="#141414" name="Avg P&L" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-12">
          <CardHeader>
            <h3 className="font-serif italic text-xl">Setup Breakdown</h3>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={setupBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontFamily: 'monospace' }} width={120} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontFamily: 'monospace', fontSize: '10px' }} />
                <Bar dataKey="value" fill="#141414" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
