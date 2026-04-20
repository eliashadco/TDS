import * as React from 'react';
import { cn } from '../../lib/utils';

export function Badge({ className, variant = 'neutral', children }: { className?: string; variant?: 'neutral' | 'success' | 'warning' | 'error' | 'outline'; children: React.ReactNode }) {
  const variants = {
    neutral: 'bg-gray-100 text-gray-800 border-gray-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    outline: 'bg-transparent text-gray-600 border-gray-300',
  };

  return (
    <span className={cn('px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-full', variants[variant], className)}>
      {children}
    </span>
  );
}
