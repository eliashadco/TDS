import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tds-focus focus-visible:ring-offset-2 focus-visible:ring-offset-tds-bg",
  {
    variants: {
      variant: {
        default: "bg-tds-slate text-white shadow-[0_22px_46px_-24px_rgba(13,21,40,0.7)] hover:-translate-y-0.5 hover:bg-[#162649]",
        secondary: "border border-white/80 bg-white/82 text-tds-text shadow-sm hover:border-tds-border hover:bg-white",
        ghost: "text-tds-dim hover:bg-white/70 hover:text-tds-text",
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-10 px-3.5",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
