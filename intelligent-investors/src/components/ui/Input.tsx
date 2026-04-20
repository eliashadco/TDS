import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full bg-white border border-[var(--line)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--ink)] placeholder:text-gray-400',
          className
        )}
        {...props}
      />
    );
  }
);
