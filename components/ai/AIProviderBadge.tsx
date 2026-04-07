import { cn } from "@/lib/utils";
import type { AIResponseMeta } from "@/lib/ai/response";

type AIProviderBadgeProps = {
  meta: AIResponseMeta;
  className?: string;
};

function providerLabel(provider: AIResponseMeta["provider"]): string {
  if (provider === "gemini") {
    return "Gemini";
  }

  if (provider === "groq") {
    return "Groq";
  }

  return "Anthropic";
}

function providerClassName(provider: AIResponseMeta["provider"]): string {
  if (provider === "gemini") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (provider === "groq") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-violet-200 bg-violet-50 text-violet-700";
}

export default function AIProviderBadge({ meta, className }: AIProviderBadgeProps) {
  const label = providerLabel(meta.provider);
  const title = meta.model ? `${label} • ${meta.model}` : label;

  return (
    <span
      title={title}
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        providerClassName(meta.provider),
        className,
      )}
    >
      AI {label}
    </span>
  );
}
