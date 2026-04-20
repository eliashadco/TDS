import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Strategy, Trade, Direction, TradeAssessment } from '../../lib/types';
import { buildBlankStrategyPreset } from '../../lib/strategies';
import { ThesisStep } from './ThesisStep';
import { AssessmentStep } from './AssessmentStep';
import { SizingStep } from './SizingStep';
import { ConfirmStep } from './ConfirmStep';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { cn } from '../../lib/utils';

export function NewTradeClient() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useWorkspace();
  const [step, setStep] = React.useState(1);
  const [strategy, setStrategy] = React.useState<Strategy | null>(null);
  const [trade, setTrade] = React.useState<Partial<Trade>>({
    symbol: location.state?.symbol || '',
    direction: location.state?.direction || 'LONG',
    thesis: location.state?.thesis || '',
    catalystWindow: location.state?.catalystWindow || '',
    invalidationCondition: location.state?.invalidationCondition || '',
    fundamentalScore: 0,
    technicalScore: 0,
    isOverride: false,
    assessment: location.state?.assessment || undefined,
    source: location.state?.source || 'MANUAL',
    status: 'PLANNING',
    conviction: 'NONE',
    positionSize: 0,
  });

  React.useEffect(() => {
    if (location.state?.assessment) {
      setStep(3); // Skip to sizing if already assessed
    }
  }, [location.state]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchStrategy() {
      if (!profile) return;
      
      const q = query(
        collection(db, 'strategies'),
        where('userId', '==', profile.uid),
        where('mode', '==', profile.mode),
        where('isDefault', '==', true)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setStrategy({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Strategy);
      } else {
        // Fallback to preset
        setStrategy(buildBlankStrategyPreset(profile.mode) as Strategy);
      }
      setLoading(false);
    }
    fetchStrategy();
  }, [profile]);

  const handleNext = async () => {
    if (step === 2 && trade.assessment?.verdict === 'CAUTION') {
      // Conflict Rule: Move to Watchlist
      if (!profile || !trade.symbol) return;
      try {
        await addDoc(collection(db, 'watchlist_items'), {
          userId: profile.uid,
          ticker: trade.symbol,
          direction: trade.direction,
          mode: profile.mode,
          strategyId: strategy?.id || 'preset',
          strategySnapshot: strategy,
          scores: trade.assessment,
          verdict: 'CAUTION',
          status: 'SCORED',
          note: `Conflict Rule: F=${trade.assessment.fundamentalScore}, T=${trade.assessment.technicalScore}. Thesis: ${trade.thesis}`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        navigate('/marketwatch');
      } catch (error) {
        console.error("Error saving to watchlist:", error);
      }
      return;
    }
    setStep(s => s + 1);
  };
  const handleBack = () => setStep(s => s - 1);

  const handleComplete = async (isOverride?: boolean) => {
    if (!profile || !trade.symbol) return;
    
    try {
      await addDoc(collection(db, 'trades'), {
        ...trade,
        isOverride: !!isOverride,
        userId: profile.uid,
        mode: profile.mode,
        strategyId: strategy?.id || 'preset',
        strategySnapshot: strategy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        journals: [],
      });
      navigate('/dashboard');
    } catch (error) {
      console.error("Error saving trade:", error);
    }
  };

  if (loading) return <div>Loading strategy...</div>;

  const steps = [
    { id: 1, label: 'Thesis' },
    { id: 2, label: 'Assessment' },
    { id: 3, label: 'Sizing' },
    { id: 4, label: 'Confirm' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-serif italic text-4xl">New Trade Entry</h2>
          <p className="text-sm opacity-50 mt-1">Gated execution for {profile?.mode} lane.</p>
        </div>
        <div className="flex gap-2">
          {steps.map((s) => (
            <div
              key={s.id}
              className={cn(
                'w-24 h-1 transition-all',
                step >= s.id ? 'bg-[var(--ink)]' : 'bg-gray-200'
              )}
            />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Step {step}:</span>
            <h3 className="font-serif italic text-xl">{steps[step - 1].label}</h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Active Strategy</p>
            <p className="text-sm font-mono">{strategy?.name}</p>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          {step === 1 && (
            <ThesisStep
              data={trade}
              onChange={(d) => setTrade(t => ({ ...t, ...d }))}
              onNext={handleNext}
            />
          )}
          {step === 2 && (
            <AssessmentStep
              trade={trade as Trade}
              strategy={strategy!}
              onUpdate={(assessment) => setTrade(t => ({ ...t, assessment }))}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {step === 3 && (
            <SizingStep
              trade={trade as Trade}
              profile={profile!}
              onUpdate={(sizing) => setTrade(t => ({ ...t, ...sizing }))}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {step === 4 && (
            <ConfirmStep
              trade={trade as Trade}
              onComplete={handleComplete}
              onBack={handleBack}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
