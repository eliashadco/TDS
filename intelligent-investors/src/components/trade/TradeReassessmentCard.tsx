import * as React from 'react';
import { Trade, Strategy } from '../../lib/types';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Zap, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { assessThesis } from '../../services/gemini';
import { getConviction } from '../../lib/scoring';
import { AssessmentMatrix } from './AssessmentMatrix';
import { motion, AnimatePresence } from 'motion/react';

export function TradeReassessmentCard({ trade, strategy }: { trade: Trade; strategy: Strategy }) {
  const [isReassessing, setIsReassessing] = React.useState(false);
  const [showMatrix, setShowMatrix] = React.useState(false);

  const handleReassess = async () => {
    setIsReassessing(true);
    try {
      const assessment = await assessThesis(trade.thesis, strategy, trade.direction);
      const conviction = getConviction(assessment.fundamentalScore, assessment.technicalScore);
      
      await updateDoc(doc(db, 'trades', trade.id), {
        assessment,
        conviction,
        fundamentalScore: assessment.fundamentalScore,
        technicalScore: assessment.technicalScore,
        updatedAt: serverTimestamp(),
      });
      
      // Add journal entry
      const newJournal = {
        timestamp: new Date(),
        content: `AI Reassessment triggered. New verdict: ${assessment.verdict}. Conviction: ${conviction}.`,
        type: 'SYSTEM' as const,
      };
      
      await updateDoc(doc(db, 'trades', trade.id), {
        journals: [...(trade.journals || []), newJournal],
      });
      
    } catch (error) {
      console.error("Reassessment failed:", error);
    } finally {
      setIsReassessing(false);
    }
  };

  return (
    <Card className="border-2 border-[var(--ink)]/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw size={18} className="text-[var(--ink)] opacity-50" />
          <h3 className="font-serif italic text-xl">Active Reassessment</h3>
        </div>
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={handleReassess} 
          disabled={isReassessing}
          className="h-8 text-[10px] font-mono uppercase tracking-widest"
        >
          {isReassessing ? (
            <RefreshCw size={14} className="animate-spin mr-2" />
          ) : (
            <Zap size={14} className="mr-2" />
          )}
          Trigger AI Audit
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-gray-50 border border-[var(--line)] rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {trade.assessment?.verdict === 'PASS' && <CheckCircle2 className="text-green-600" size={20} />}
              {trade.assessment?.verdict === 'FAIL' && <AlertCircle className="text-red-600" size={20} />}
              {trade.assessment?.verdict === 'CAUTION' && <AlertCircle className="text-yellow-600" size={20} />}
              <span className="font-serif italic text-xl">{trade.assessment?.verdict}</span>
            </div>
            <div className="h-8 w-px bg-[var(--line)]" />
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Conviction</span>
              <span className="font-mono font-bold text-sm">{trade.conviction}</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowMatrix(!showMatrix)}
            className="text-[10px] font-mono uppercase tracking-widest"
          >
            {showMatrix ? 'Hide Details' : 'View Matrix'}
          </Button>
        </div>

        <AnimatePresence>
          {showMatrix && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <AssessmentMatrix assessment={trade.assessment!} strategy={strategy} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
          <p className="text-[10px] font-mono uppercase text-yellow-800 tracking-widest mb-2 flex items-center gap-2">
            <AlertCircle size={12} />
            Operational Guidance
          </p>
          <p className="text-xs font-mono italic leading-relaxed text-yellow-900">
            {trade.assessment?.edge || 'No active guidance. Trigger an audit to refresh.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
