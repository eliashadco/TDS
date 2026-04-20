import * as React from 'react';
import { X, TrendingUp, TrendingDown, Shield, Zap, Target, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Strategy, TradingMode, Direction, TradeAssessment } from '../../lib/types';
import { formatCurrency, formatPercent, cn } from '../../lib/utils';
import { PriceChart } from '../trade/PriceChart';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { assessThesis } from '../../services/gemini';

import { useNavigate } from 'react-router-dom';

interface PreviewProps {
  ticker: string;
  onClose: () => void;
  onWatch: (t: string) => void;
  isWatched: boolean;
}

export function InstrumentPreviewDrawer({ ticker, onClose, onWatch, isWatched }: PreviewProps) {
  const navigate = useNavigate();
  const { profile, strategies } = useWorkspace();
  const [quote, setQuote] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [direction, setDirection] = React.useState<Direction>('LONG');
  const [selectedStrategy, setSelectedStrategy] = React.useState<Strategy | null>(null);
  const [thesis, setThesis] = React.useState('');
  const [assessing, setAssessing] = React.useState(false);
  const [assessment, setAssessment] = React.useState<TradeAssessment | null>(null);

  React.useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await fetch(`/api/market/quote?ticker=${ticker}`);
        const data = await res.json();
        setQuote(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();

    if (strategies.length > 0) {
      const defaultStrat = strategies.find(s => s.isDefault) || strategies[0];
      setSelectedStrategy(defaultStrat);
    }
  }, [ticker, strategies]);

  const handleAssess = async () => {
    if (!selectedStrategy || !thesis || assessing) return;
    setAssessing(true);
    try {
      const data = await assessThesis(thesis, selectedStrategy, direction, ticker);
      setAssessment(data);

      // Save to watchlist as SCORED
      if (profile) {
        await addDoc(collection(db, 'watchlist_items'), {
          userId: profile.uid,
          ticker: ticker.toUpperCase(),
          direction,
          mode: profile.mode,
          strategyId: selectedStrategy.id,
          strategySnapshot: selectedStrategy,
          scores: data,
          verdict: data.verdict === 'PASS' ? 'GO' : data.verdict === 'CAUTION' ? 'CAUTION' : 'SKIP',
          note: thesis,
          status: 'SCORED',
          lastScoredAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAssessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="w-full max-w-2xl bg-[var(--bg)] border-l border-[var(--line)] shadow-2xl overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-[var(--bg)] border-b border-[var(--line)]">
          <div className="flex items-center gap-4">
            <h2 className="font-serif italic text-3xl">{ticker}</h2>
            {quote && (
              <div className="flex items-center gap-3">
                <span className="font-mono text-xl">{formatCurrency(quote.price)}</span>
                <span className={cn('font-mono text-sm', quote.changePercent >= 0 ? 'text-green-600' : 'text-red-600')}>
                  {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-10">
          {/* Chart Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="col-header">Market Context</h3>
              <Badge variant="outline" className="font-mono text-[10px]">LIVE FEED</Badge>
            </div>
            <div className="h-64 bg-white border border-[var(--line)] rounded-lg overflow-hidden">
              <PriceChart symbol={ticker} />
            </div>
          </section>

          {/* Scoring Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-serif italic text-2xl">Strategy Scoring</h3>
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                {(['LONG', 'SHORT'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className={cn(
                      'px-4 py-1 text-[10px] font-mono uppercase tracking-widest transition-all',
                      direction === d ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-gray-500 hover:text-[var(--ink)]'
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="col-header block">Select Strategy Lane</label>
              <div className="grid grid-cols-2 gap-3">
                {strategies.filter(s => s.mode === profile?.mode).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStrategy(s)}
                    className={cn(
                      'p-4 text-left border transition-all rounded-lg',
                      selectedStrategy?.id === s.id
                        ? 'border-[var(--ink)] bg-white shadow-md ring-1 ring-[var(--ink)]'
                        : 'border-[var(--line)] hover:border-gray-400 opacity-60'
                    )}
                  >
                    <div className="font-bold text-sm">{s.name}</div>
                    <div className="text-[10px] opacity-50 mt-1 uppercase tracking-tighter">
                      {s.metrics.length} metrics • v{s.version}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="col-header block">Thesis & Evidence</label>
              <textarea
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                placeholder="Why this trade? What are the key levels? What is the catalyst?"
                className="w-full h-32 p-4 bg-white border border-[var(--line)] rounded-lg font-mono text-sm focus:ring-1 focus:ring-[var(--ink)] outline-none resize-none"
              />
            </div>

            <Button
              className="w-full h-14 text-lg font-serif italic"
              disabled={!thesis || assessing || !selectedStrategy}
              onClick={handleAssess}
            >
              {assessing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={20} />
                  AI Assessing Evidence...
                </span>
              ) : (
                'Run Strategy Score'
              )}
            </Button>
          </section>

          {/* Assessment Result */}
          <AnimatePresence>
            {assessment && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6 pt-6 border-t border-[var(--line)]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-serif italic text-2xl">Assessment Result</h3>
                  <Badge
                    className={cn(
                      'text-lg px-4 py-1',
                      assessment.verdict === 'PASS' ? 'bg-green-100 text-green-800' :
                      assessment.verdict === 'CAUTION' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    )}
                  >
                    {assessment.verdict}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-white border-[var(--line)]">
                    <CardHeader className="p-4 pb-2">
                      <h4 className="col-header flex items-center gap-2">
                        <Target size={14} /> The Edge
                      </h4>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-sm opacity-80 leading-relaxed">
                      {assessment.edge}
                    </CardContent>
                  </Card>
                  <Card className="bg-white border-[var(--line)]">
                    <CardHeader className="p-4 pb-2">
                      <h4 className="col-header flex items-center gap-2">
                        <AlertCircle size={14} /> Key Risks
                      </h4>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-sm opacity-80 leading-relaxed">
                      {assessment.risks}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <h4 className="col-header">Metric Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(assessment.metrics).map(([id, m]: [string, any]) => (
                      <div key={id} className="flex items-start gap-3 p-3 bg-white border border-[var(--line)] rounded-lg">
                        {m.passed ? (
                          <CheckCircle2 className="text-green-600 mt-0.5 shrink-0" size={16} />
                        ) : (
                          <AlertCircle className="text-red-600 mt-0.5 shrink-0" size={16} />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{id}</span>
                            <span className="font-mono text-[10px] opacity-40">{m.score}/10</span>
                          </div>
                          <p className="text-xs opacity-60 mt-1">{m.reasoning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[var(--ink)] text-[var(--bg)] p-6 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 opacity-50 uppercase tracking-widest text-[10px]">
                    <Info size={12} /> AI Summary
                  </div>
                  <p className="font-serif italic text-lg leading-relaxed">
                    "{assessment.summary}"
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button variant="outline" className="flex-1 h-12" onClick={onClose}>
                    Keep in Workbench
                  </Button>
                  <Button className="flex-1 h-12" onClick={() => {
                    navigate('/trade/new', { 
                      state: { 
                        symbol: ticker, 
                        direction, 
                        thesis, 
                        assessment, 
                        source: 'MARKETWATCH' 
                      } 
                    });
                  }}>
                    Deploy to Trade
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
