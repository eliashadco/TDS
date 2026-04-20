import * as React from 'react';
import { TradingMode } from '../../lib/types';
import { useWorkspace } from '../../hooks/useWorkspace';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';
import { Shield, Zap, Target, TrendingUp } from 'lucide-react';

const modes: { id: TradingMode; label: string; icon: any; desc: string }[] = [
  { id: 'investment', label: 'Investment', icon: Shield, desc: 'Long-term wealth building' },
  { id: 'swing', label: 'Swing', icon: TrendingUp, desc: 'Multi-day momentum' },
  { id: 'daytrade', label: 'Day Trade', icon: Target, desc: 'Intraday volatility' },
  { id: 'scalp', label: 'Scalp', icon: Zap, desc: 'High-frequency precision' },
];

export function ModeSelector() {
  const { profile, updateMode } = useWorkspace();

  if (!profile) return null;

  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg border border-[var(--line)]">
      {modes.map((mode) => {
        const isActive = profile.mode === mode.id;
        const Icon = mode.icon;

        return (
          <button
            key={mode.id}
            onClick={() => updateMode(mode.id)}
            className={cn(
              'relative flex items-center gap-2 px-3 py-1.5 rounded-md transition-all group',
              isActive 
                ? 'bg-white text-[var(--ink)] shadow-sm' 
                : 'text-gray-500 hover:text-[var(--ink)] hover:bg-gray-200'
            )}
            title={mode.desc}
          >
            <Icon size={14} className={cn(isActive ? 'text-[var(--ink)]' : 'text-gray-400')} />
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
              {mode.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="active-mode"
                className="absolute inset-0 border border-[var(--ink)]/10 rounded-md pointer-events-none"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
