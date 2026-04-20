import * as React from 'react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { PortfolioResetCard } from './PortfolioResetCard';
import { LearnToggle } from '../learn/LearnToggle';
import { db } from '../../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Save, User, Mail, Wallet } from 'lucide-react';

export function ProfileSettingsClient() {
  const { profile } = useWorkspace();
  const [equity, setEquity] = React.useState(profile?.equity || 0);
  const [riskPerTrade, setRiskPerTrade] = React.useState(profile?.riskPerTrade || 1);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (profile) {
      setEquity(profile.equity);
      setRiskPerTrade(profile.riskPerTrade);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const profileRef = doc(db, 'profiles', profile.uid);
      await updateDoc(profileRef, {
        equity: Number(equity),
        riskPerTrade: Number(riskPerTrade),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-20">
      <header>
        <h2 className="font-serif italic text-4xl">Profile Settings</h2>
        <p className="text-sm opacity-50 mt-1">Manage your identity and risk parameters.</p>
      </header>

      <div className="space-y-8">
        <Card className="bg-white border-[var(--line)]">
          <CardHeader className="p-6 border-b border-[var(--line)]">
            <h3 className="col-header flex items-center gap-2">
              <User size={14} /> Identity & Account
            </h3>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase opacity-50 flex items-center gap-2">
                  <Mail size={10} /> Email Address
                </label>
                <Input value={profile?.email} disabled className="opacity-50" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase opacity-50 flex items-center gap-2">
                  <Wallet size={10} /> Total Equity ($)
                </label>
                <Input 
                  type="number" 
                  value={equity} 
                  onChange={(e) => setEquity(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase opacity-50">Risk Per Trade (%)</label>
                <Input 
                  type="number" 
                  step="0.1"
                  value={riskPerTrade} 
                  onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="pt-4 border-t border-[var(--line)] flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-xs font-bold">Instructional Overlays</p>
                <p className="text-[10px] opacity-50">Show learning tooltips across the platform.</p>
              </div>
              <LearnToggle />
            </div>
            <div className="pt-4 flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2" size={16} />
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <PortfolioResetCard />
      </div>
    </div>
  );
}
