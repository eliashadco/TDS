import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-12 w-full rounded-[22px] border border-[rgba(225,211,196,0.94)] bg-[rgba(255,251,246,0.96)] px-4 py-3 text-[0.95rem] text-tds-text shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_16px_30px_-24px_rgba(69,48,30,0.45)] placeholder:text-[#8b7865] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tds-focus focus-visible:ring-offset-2 focus-visible:ring-offset-tds-bg disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
