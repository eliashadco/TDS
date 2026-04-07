import { cn } from "@/lib/utils";
import type { QuoteDataStatus, QuoteProvider } from "@/types/market";

type QuoteStatusBadgeProps = {
  status?: QuoteDataStatus | null;
  provider?: QuoteProvider | null;
  className?: string;
  tone?: "light" | "dark";
};

type QuoteStatusLegendProps = {
  tone?: "light" | "dark";
  className?: string;
};

type StatusMeta = {
  label: string;
  description: string;
  badgeClassName: string;
};

function getStatusMeta(status?: QuoteDataStatus | null, provider?: QuoteProvider | null, tone: "light" | "dark" = "light"): StatusMeta {
  const dark = tone === "dark";

  if (status === "live") {
    return {
      label: "Live",
      description: "Current quote from the primary feed.",
      badgeClassName: dark
        ? "border-emerald-300/30 bg-emerald-400/12 text-emerald-100"
        : "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (status === "delayed") {
    return {
      label: "Delayed",
      description: "Exchange-delayed quote.",
      badgeClassName: dark
        ? "border-amber-300/30 bg-amber-300/12 text-amber-100"
        : "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (status === "cached") {
    return {
      label: "Cached",
      description: "Last saved quote.",
      badgeClassName: dark
        ? "border-slate-200/20 bg-white/10 text-slate-100"
        : "border-slate-200 bg-slate-100 text-slate-700",
    };
  }

  if (status === "fallback") {
    const description =
      provider === "yahoo"
        ? "Quote from Yahoo fallback feed."
        : provider === "polygon"
          ? "Fallback quote (for example, previous close)."
          : "Fallback market quote.";

    return {
      label: "Fallback",
      description,
      badgeClassName: dark
        ? "border-sky-300/30 bg-sky-400/12 text-sky-100"
        : "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  return {
    label: "Pending",
    description: "Waiting for quote status.",
    badgeClassName: dark
      ? "border-slate-200/20 bg-white/8 text-slate-200"
      : "border-slate-200 bg-white text-slate-600",
  };
}

export function QuoteStatusBadge({ status, provider, className, tone = "light" }: QuoteStatusBadgeProps) {
  const meta = getStatusMeta(status, provider, tone);

  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        meta.badgeClassName,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function QuoteStatusLegend({ tone = "light", className }: QuoteStatusLegendProps) {
  const statuses: QuoteDataStatus[] = ["live", "delayed", "cached", "fallback"];

  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {statuses.map((status) => {
        const meta = getStatusMeta(status, null, tone);
        return (
          <div key={status} className="flex items-start gap-2">
            <QuoteStatusBadge status={status} provider={null} tone={tone} />
            <p className={cn("max-w-[220px] text-xs leading-5", tone === "dark" ? "text-white/72" : "text-tds-dim")}>{meta.description}</p>
          </div>
        );
      })}
    </div>
  );
}