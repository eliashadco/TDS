import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tds-focus focus-visible:ring-offset-2 focus-visible:ring-offset-tds-bg",
  {
    variants: {
      variant: {
        default: "bg-[linear-gradient(135deg,#1a2433_0%,#24364a_54%,#355766_100%)] text-white shadow-[0_24px_54px_-28px_rgba(42,31,24,0.58)] hover:-translate-y-0.5 hover:shadow-[0_28px_64px_-32px_rgba(42,31,24,0.62)]",
        secondary: "border border-[rgba(222,206,188,0.95)] bg-[rgba(255,251,246,0.84)] text-tds-text shadow-[0_14px_36px_-26px_rgba(69,48,30,0.28)] hover:border-[rgba(180,83,9,0.24)] hover:bg-white",
        ghost: "text-tds-dim hover:bg-white/70 hover:text-tds-text",
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-10 px-3.5",
        lg: "h-12 px-6 text-[0.82rem] uppercase tracking-[0.14em]",
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
