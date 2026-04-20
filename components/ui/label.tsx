import * as React from "react";
import { cn } from "@/lib/utils";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => {
  return <label ref={ref} className={cn("text-[11px] font-semibold uppercase tracking-[0.2em] text-[#735d48]", className)} {...props} />;
});
Label.displayName = "Label";

export { Label };
