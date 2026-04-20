import * as React from 'react';
import { TradeAssessment, Strategy } from '../../lib/types';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export function AssessmentMatrix({ assessment, strategy, fundamentalScore, technicalScore }: { assessment: TradeAssessment; strategy: Strategy; fundamentalScore?: number; technicalScore?: number }) {
  return (
    <div className="space-y-6">
      {(fundamentalScore !== undefined || technicalScore !== undefined) && (
        <div className="grid grid-cols-2 gap-4">
          <div className={cn(
            "p-4 border rounded-lg",
            fundamentalScore! >= 3 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
          )}>
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Fundamental Gate</p>
            <p className="font-mono text-xl font-bold">{fundamentalScore}/5</p>
          </div>
          <div className={cn(
            "p-4 border rounded-lg",
            technicalScore! === 3 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
          )}>
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest mb-1">Technical Gate</p>
            <p className="font-mono text-xl font-bold">{technicalScore}/3</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {strategy.metrics.map((metric) => {
        const result = assessment.metrics[metric.id];
        const isPassed = result?.passed;
        
        return (
          <div 
            key={metric.id} 
            className={cn(
              'p-4 border rounded-lg flex items-start gap-4 transition-all',
              isPassed ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
            )}
          >
            <div className="mt-1">
              {isPassed ? (
                <CheckCircle2 size={18} className="text-green-600" />
              ) : (
                <XCircle size={18} className="text-red-600" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold opacity-70">
                  {metric.name}
                </span>
                <span className={cn(
                  'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
                  isPassed ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                )}>
                  {isPassed ? 'PASS' : 'FAIL'}
                </span>
              </div>
              <p className="text-xs font-mono leading-relaxed opacity-80">
                {result?.reasoning || 'No assessment provided.'}
              </p>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
