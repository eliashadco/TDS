import * as React from 'react';
import { Trade, Strategy, TradeAssessment } from '../../lib/types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

import { AssessmentMatrix } from './AssessmentMatrix';

export function AssessmentStep({ trade, strategy, onUpdate, onNext, onBack }: { trade: Trade; strategy: Strategy; onUpdate: (a: TradeAssessment) => void; onNext: () => void; onBack: () => void }) {
  const [loading, setLoading] = React.useState(false);

  const handleScore = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: trade.symbol,
          direction: trade.direction,
          thesis: trade.thesis,
          catalystWindow: trade.catalystWindow,
          invalidationCondition: trade.invalidationCondition,
          strategy,
        }),
      });
      const assessment = await response.json();
      onUpdate(assessment);
    } catch (error) {
      console.error("Scoring failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const assessment = trade.assessment;

  return (
    <div className="space-y-8">
      {!assessment && !loading && (
        <div className="py-12 text-center space-y-6">
          <div className="max-w-md mx-auto">
            <h4 className="font-serif italic text-2xl mb-2">Ready to Score</h4>
            <p className="text-sm opacity-50">The system will now evaluate your thesis against the {strategy.metrics.length} metrics and the Mechanical Gates (F1-F5, T1-T3).</p>
          </div>
          <Button onClick={handleScore} className="px-12 py-4">
            Run Mechanical Audit
          </Button>
        </div>
      )}

      {loading && (
        <div className="py-24 text-center space-y-4">
          <Loader2 className="mx-auto animate-spin opacity-20" size={48} />
          <p className="font-mono text-xs uppercase tracking-widest opacity-50">AI is auditing evidence...</p>
        </div>
      )}

      {assessment && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 border border-[var(--line)] bg-white">
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Verdict</p>
              <div className="flex items-center gap-2">
                {assessment.verdict === 'PASS' && <CheckCircle2 className="text-green-600" size={20} />}
                {assessment.verdict === 'FAIL' && <XCircle className="text-red-600" size={20} />}
                {assessment.verdict === 'CAUTION' && <AlertCircle className="text-yellow-600" size={20} />}
                <span className="font-serif italic text-xl">{assessment.verdict}</span>
              </div>
            </div>
            <div className="p-4 border border-[var(--line)] bg-white">
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Fundamental</p>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-mono text-xl font-bold",
                  assessment.fundamentalScore >= 3 ? "text-green-600" : "text-red-600"
                )}>
                  {assessment.fundamentalScore}/5
                </span>
                <Badge variant={assessment.fundamentalScore >= 3 ? 'success' : 'error'}>
                  {assessment.fundamentalScore >= 3 ? 'PASS' : 'FAIL'}
                </Badge>
              </div>
            </div>
            <div className="p-4 border border-[var(--line)] bg-white">
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Technical</p>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-mono text-xl font-bold",
                  assessment.technicalScore === 3 ? "text-green-600" : "text-red-600"
                )}>
                  {assessment.technicalScore}/3
                </span>
                <Badge variant={assessment.technicalScore === 3 ? 'success' : 'error'}>
                  {assessment.technicalScore === 3 ? 'PASS' : 'FAIL'}
                </Badge>
              </div>
            </div>
            <div className="p-4 border border-[var(--line)] bg-white">
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Action</p>
              <p className="text-xs font-bold uppercase tracking-widest mt-1">
                {assessment.verdict === 'PASS' ? 'Deploy Trade' : 
                 assessment.verdict === 'CAUTION' ? 'Watchlist Only' : 'Skip Trade'}
              </p>
            </div>
          </div>

          {assessment.verdict === 'CAUTION' && (
            <div className="p-4 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-mono flex items-center gap-3">
              <AlertCircle size={16} />
              <span>Conflict Rule: Fundamentals pass but Technicals fail. Trade is restricted to Watchlist until price alignment.</span>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest px-4">Audit Matrix</p>
            <div className="px-4">
              <AssessmentMatrix 
                assessment={assessment} 
                strategy={strategy} 
                fundamentalScore={assessment.fundamentalScore}
                technicalScore={assessment.technicalScore}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Edge</p>
              <p className="text-sm p-4 bg-green-50 border border-green-200 italic">{assessment.edge}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Risks</p>
              <p className="text-sm p-4 bg-red-50 border border-red-200 italic">{assessment.risks}</p>
            </div>
          </div>

          <div className="flex justify-between pt-8 border-t border-[var(--line)]">
            <Button variant="outline" onClick={onBack}>Back to Thesis</Button>
            <div className="flex gap-4">
              <Button variant="secondary" onClick={handleScore}>Re-Audit</Button>
              {assessment.verdict === 'CAUTION' ? (
                <Button onClick={onNext} className="bg-blue-600 hover:bg-blue-700">
                  Move to Watchlist
                </Button>
              ) : (
                <Button onClick={onNext} disabled={assessment.verdict === 'FAIL'}>
                  Lock Sizing
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
