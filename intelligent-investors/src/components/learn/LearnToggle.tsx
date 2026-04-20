import * as React from 'react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Button } from '../ui/Button';
import { HelpCircle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

export function LearnToggle() {
  const { profile, updateLearnMode } = useWorkspace();

  if (!profile) return null;

  return (
    <button
      onClick={() => updateLearnMode(!profile.learnMode)}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all',
        profile.learnMode 
          ? 'bg-blue-50 border-blue-200 text-blue-700' 
          : 'bg-white border-[var(--line)] text-gray-400 hover:text-gray-600'
      )}
    >
      <HelpCircle size={14} />
      <span className="text-[10px] font-mono uppercase tracking-widest font-bold">
        {profile.learnMode ? 'Learn Mode: ON' : 'Learn Mode: OFF'}
      </span>
    </button>
  );
}

export function LearnOverlay({ children, title, description }: { children: React.ReactNode; title: string; description: string }) {
  const { profile } = useWorkspace();

  if (!profile?.learnMode) return <>{children}</>;

  return (
    <div className="relative group/learn">
      {children}
      <div className="absolute -top-2 -right-2 z-10">
        <div className="relative">
          <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg cursor-help animate-bounce">
            <Info size={12} />
          </div>
          <div className="absolute bottom-full right-0 mb-2 w-64 p-4 bg-[var(--ink)] text-[var(--bg)] text-xs font-mono rounded-lg opacity-0 group-hover/learn:opacity-100 transition-opacity pointer-events-none shadow-2xl border border-white/10">
            <p className="font-bold uppercase tracking-widest mb-2 text-blue-400 border-b border-white/10 pb-1">{title}</p>
            <p className="leading-relaxed opacity-80 italic">"{description}"</p>
          </div>
        </div>
      </div>
    </div>
  );
}
