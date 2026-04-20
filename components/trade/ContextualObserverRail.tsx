import React from 'react';
import { AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react';
import { detectContradictions } from '@/lib/trading/validation';
import type { TradeThesis } from '@/types/trade';

interface ContextualObserverRailProps {
  thesis: TradeThesis;
  aiSuggestion?: string | null; // Assuming AI can provide suggestions here
}

/**
 * The ContextualObserverRail observes the user's current trade thesis
 * and provides real-time feedback, warnings, and AI suggestions.
 * It uses the detectContradictions logic from `lib/trading/validation.ts`.
 */
export function ContextualObserverRail({ thesis, aiSuggestion }: ContextualObserverRailProps) {
  const warnings = React.useMemo(() => {
    // Only run detection if key fields are present
    if (!thesis.direction || !thesis.thesis || thesis.setupTypes === undefined) {
      return [];
    }
    return detectContradictions(thesis);
  }, [thesis]);

  const hasWarnings = warnings.length > 0;
  const hasAISuggestion = !!aiSuggestion;

  if (!hasWarnings && !hasAISuggestion && !thesis.thesis) {
    return (
      <div className="trade-observer-empty">
        <p>Start typing your thesis to receive real-time mechanical insights and alerts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasWarnings && (
        <div className="trade-observer-alert warn">
          <AlertTriangle className="trade-observer-icon" />
          <div>
            <h3>Contradiction Alerts</h3>
            <ul className="mt-1 list-disc list-inside text-sm space-y-0.5">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {hasAISuggestion && (
        <div className="trade-observer-alert info">
          <Lightbulb className="trade-observer-icon" />
          <div>
            <h3>AI Insight</h3>
            <p className="mt-1 text-sm">{aiSuggestion}</p>
          </div>
        </div>
      )}

      {!hasWarnings && thesis.thesis && (
        <div className="trade-observer-alert success">
          <CheckCircle className="trade-observer-icon" />
          <p className="text-sm font-medium">Thesis looks consistent. Proceed with scoring.</p>
        </div>
      )}
    </div>
  );
}