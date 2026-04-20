import * as React from 'react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Strategy, Metric } from '../../lib/types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { db } from '../../lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { Plus, Trash2, Save, RefreshCw, Shield, TrendingUp, Target, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export function MetricsEditorClient() {
  const { profile } = useWorkspace();
  const [strategies, setStrategies] = React.useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = React.useState<Strategy | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRating, setIsRating] = React.useState(false);
  const [rating, setRating] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'user_strategies'),
      where('userId', '==', profile.uid),
      where('mode', '==', profile.mode)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Strategy));
      setStrategies(data);
      if (!selectedStrategy && data.length > 0) {
        setSelectedStrategy(data.find(s => s.isDefault) || data[0]);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'user_strategies');
    });

    return unsubscribe;
  }, [profile]);

  const handleAddMetric = () => {
    if (!selectedStrategy) return;
    const newMetric: Metric = {
      id: crypto.randomUUID(),
      name: 'New Metric',
      category: 'Technical',
      description: 'Describe the metric goal...',
      longInterpretation: 'What to look for in a LONG setup',
      shortInterpretation: 'What to look for in a SHORT setup',
      weight: 1,
      isRequired: true
    };
    setSelectedStrategy({
      ...selectedStrategy,
      metrics: [...selectedStrategy.metrics, newMetric]
    });
  };

  const handleUpdateMetric = (id: string, updates: Partial<Metric>) => {
    if (!selectedStrategy) return;
    setSelectedStrategy({
      ...selectedStrategy,
      metrics: selectedStrategy.metrics.map(m => m.id === id ? { ...m, ...updates } : m)
    });
  };

  const handleRemoveMetric = (id: string) => {
    if (!selectedStrategy) return;
    setSelectedStrategy({
      ...selectedStrategy,
      metrics: selectedStrategy.metrics.filter(m => m.id !== id)
    });
  };

  const handleSave = async () => {
    if (!selectedStrategy || !profile) return;
    setIsSaving(true);
    try {
      const strategyRef = doc(db, 'user_strategies', selectedStrategy.id);
      await updateDoc(strategyRef, {
        ...selectedStrategy,
        version: selectedStrategy.version + 1,
        updatedAt: serverTimestamp()
      });
      // Also create a version snapshot
      await addDoc(collection(db, 'strategy_versions'), {
        strategyId: selectedStrategy.id,
        userId: profile.uid,
        snapshot: selectedStrategy,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRateStrategy = async () => {
    if (!selectedStrategy) return;
    setIsRating(true);
    try {
      const res = await fetch('/api/ai/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: selectedStrategy })
      });
      const data = await res.json();
      setRating(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRating(false);
    }
  };

  const modeIcons = {
    investment: Shield,
    swing: TrendingUp,
    daytrade: Target,
    scalp: Zap
  };

  if (loading) return <div>Loading strategies...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="font-serif italic text-4xl">Strategy Studio</h2>
          <p className="text-sm opacity-50 mt-1">Define the rules of your operating lanes.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRateStrategy} disabled={isRating}>
            {isRating ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Zap className="mr-2" size={16} />}
            AI Audit Strategy
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2" size={16} />
            Publish Version {selectedStrategy ? selectedStrategy.version + 1 : ''}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Strategy Sidebar */}
        <div className="space-y-4">
          <h3 className="col-header">Strategy Lanes</h3>
          <div className="space-y-2">
            {strategies.map((s) => {
              const Icon = modeIcons[s.mode as keyof typeof modeIcons] || Target;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStrategy(s)}
                  className={cn(
                    "w-full p-4 text-left border rounded-lg transition-all",
                    selectedStrategy?.id === s.id 
                      ? "border-[var(--ink)] bg-white shadow-md ring-1 ring-[var(--ink)]" 
                      : "border-[var(--line)] hover:border-gray-400 opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={14} />
                    <span className="font-bold text-sm">{s.name}</span>
                  </div>
                  <div className="text-[10px] font-mono opacity-50 uppercase">
                    {s.metrics.length} Metrics • v{s.version}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor Area */}
        <div className="lg:col-span-3 space-y-8">
          {selectedStrategy ? (
            <>
              {rating && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-blue-900 flex items-center gap-2">
                        <Zap size={16} /> AI Strategy Audit
                      </h4>
                      <Badge className="bg-blue-200 text-blue-900">Score: {rating.score}/10</Badge>
                    </div>
                    <p className="text-sm text-blue-800 mb-4 leading-relaxed">{rating.feedback}</p>
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono uppercase font-bold text-blue-700">Suggestions</p>
                      <ul className="list-disc list-inside text-xs text-blue-800 space-y-1">
                        {rating.suggestions.map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif italic text-2xl">Metric Stack</h3>
                  <Button variant="outline" size="sm" onClick={handleAddMetric}>
                    <Plus size={16} className="mr-2" /> Add Metric
                  </Button>
                </div>

                <div className="space-y-4">
                  {selectedStrategy.metrics.map((metric) => (
                    <Card key={metric.id} className="bg-white border-[var(--line)]">
                      <CardContent className="p-6 space-y-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase opacity-50">Metric Name</label>
                                <Input 
                                  value={metric.name} 
                                  onChange={(e) => handleUpdateMetric(metric.id, { name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase opacity-50">Category</label>
                                <Input 
                                  value={metric.category} 
                                  onChange={(e) => handleUpdateMetric(metric.id, { category: e.target.value })}
                                />
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-[10px] font-mono uppercase opacity-50">Description</label>
                              <textarea 
                                className="w-full p-3 border border-[var(--line)] rounded-lg text-sm font-mono focus:ring-1 focus:ring-[var(--ink)] outline-none resize-none h-20"
                                value={metric.description}
                                onChange={(e) => handleUpdateMetric(metric.id, { description: e.target.value })}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase opacity-50 text-green-700">Long Interpretation</label>
                                <textarea 
                                  className="w-full p-3 border border-green-100 bg-green-50/30 rounded-lg text-xs font-mono focus:ring-1 focus:ring-green-500 outline-none resize-none h-24"
                                  value={metric.longInterpretation}
                                  onChange={(e) => handleUpdateMetric(metric.id, { longInterpretation: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-mono uppercase opacity-50 text-red-700">Short Interpretation</label>
                                <textarea 
                                  className="w-full p-3 border border-red-100 bg-red-50/30 rounded-lg text-xs font-mono focus:ring-1 focus:ring-red-500 outline-none resize-none h-24"
                                  value={metric.shortInterpretation}
                                  onChange={(e) => handleUpdateMetric(metric.id, { shortInterpretation: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleRemoveMetric(metric.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-[var(--line)] rounded-xl opacity-40">
              <p className="font-serif italic text-xl">Select a strategy to begin editing.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
