import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-2xl border border-white/80 bg-white/88 px-4 py-2.5 text-sm text-tds-text shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_24px_-18px_rgba(15,23,42,0.35)] placeholder:text-tds-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tds-focus focus-visible:ring-offset-2 focus-visible:ring-offset-tds-bg disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
