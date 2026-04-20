import * as React from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { useWorkspace } from '../../hooks/useWorkspace';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

export function PortfolioResetCard() {
  const { profile } = useWorkspace();
  const [isResetting, setIsResetting] = React.useState(false);
  const [confirmScope, setConfirmScope] = React.useState<'NONE' | 'ACTIVITY' | 'FULL'>('NONE');

  const handleReset = async (scope: 'ACTIVITY' | 'FULL') => {
    if (!profile) return;
    setIsResetting(true);
    try {
      // 1. Reset Activity (Trades and Watchlist)
      const tradesQ = query(collection(db, 'trades'), where('userId', '==', profile.uid));
      const watchlistQ = query(collection(db, 'watchlist_items'), where('userId', '==', profile.uid));
      
      const [tradesSnap, watchlistSnap] = await Promise.all([
        getDocs(tradesQ),
        getDocs(watchlistQ)
      ]);

      const deletePromises = [
        ...tradesSnap.docs.map(d => deleteDoc(d.ref)),
        ...watchlistSnap.docs.map(d => deleteDoc(d.ref))
      ];

      if (scope === 'FULL') {
        // 2. Reset Strategies as well
        const strategiesQ = query(collection(db, 'user_strategies'), where('userId', '==', profile.uid));
        const strategiesSnap = await getDocs(strategiesQ);
        deletePromises.push(...strategiesSnap.docs.map(d => deleteDoc(d.ref)));
      }

      await Promise.all(deletePromises);
      
      // Call backend reset for any additional cleanup
      await fetch('/api/settings/reset-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope })
      });

      window.location.reload(); // Refresh to re-seed or clear state
    } catch (err) {
      console.error(err);
    } finally {
      setIsResetting(false);
      setConfirmScope('NONE');
    }
  };

  return (
    <Card className="border-red-100 bg-red-50/30">
      <CardHeader className="p-6 pb-2">
        <h3 className="font-serif italic text-xl text-red-900 flex items-center gap-2">
          <AlertTriangle size={20} /> Danger Zone
        </h3>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="font-bold text-sm text-red-900">Reset Activity Only</h4>
              <p className="text-xs text-red-800/60 leading-relaxed">
                This will delete all your trades and watchlist items. Your strategies and profile settings will remain intact.
              </p>
            </div>
            <Button 
              variant="outline" 
              className="border-red-200 text-red-700 hover:bg-red-100"
              onClick={() => setConfirmScope('ACTIVITY')}
              disabled={isResetting}
            >
              Reset Activity
            </Button>
          </div>

          <div className="flex items-start justify-between gap-4 pt-4 border-t border-red-100">
            <div className="flex-1">
              <h4 className="font-bold text-sm text-red-900">Full Workspace Reset</h4>
              <p className="text-xs text-red-800/60 leading-relaxed">
                This will wipe everything: trades, watchlist, and custom strategies. Your account will be returned to a fresh state.
              </p>
            </div>
            <Button 
              variant="outline" 
              className="border-red-200 text-red-700 hover:bg-red-100"
              onClick={() => setConfirmScope('FULL')}
              disabled={isResetting}
            >
              Full Reset
            </Button>
          </div>
        </div>

        {confirmScope !== 'NONE' && (
          <div className="p-4 bg-white border border-red-200 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
            <p className="text-sm font-bold text-red-900">
              Are you absolutely sure? This action is irreversible.
            </p>
            <div className="flex gap-3">
              <Button 
                className="bg-red-600 hover:bg-red-700 text-white flex-1"
                onClick={() => handleReset(confirmScope as 'ACTIVITY' | 'FULL')}
                disabled={isResetting}
              >
                {isResetting ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Trash2 className="mr-2" size={16} />}
                Confirm {confirmScope} Reset
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setConfirmScope('NONE')}
                disabled={isResetting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
