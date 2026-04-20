import type { TradeMode } from "@/types/trade";

type PromptMetric = {
  id: string;
  name: string;
  desc: string;
};

export function buildAssessmentPrompt(input: {
  ticker: string;
  direction: "LONG" | "SHORT";
  thesis: string;
  setups: string[];
  conditions: string[];
  chartPattern: string;
  asset: string;
  mode: string;
  strategyName?: string | null;
  strategyInstruction?: string | null;
  metrics: PromptMetric[];
}): string {
  const dirWord = input.direction === "LONG" ? "BULLISH/LONG" : "BEARISH/SHORT";
  const dirRule =
    input.direction === "SHORT"
      ? "PASS means conditions SUPPORT shorting (e.g., declining earnings = PASS, strong uptrend = FAIL)."
      : "PASS means conditions SUPPORT going long (e.g., growing earnings = PASS, downtrend = FAIL).";

  const metricList = input.metrics.map((metric) => `${metric.id}: ${metric.name} - ${metric.desc}`).join("\n");
  const setups = input.setups.length > 0 ? input.setups.join(", ") : "None supplied";
  const conditions = input.conditions.length > 0 ? input.conditions.join(", ") : "None supplied";
  const pattern = input.chartPattern && input.chartPattern !== "None" ? input.chartPattern : "No dominant pattern";
  const strategyContext = input.strategyName ? `Strategy lane: ${input.strategyName}.` : "Strategy lane: not specified.";
  const strategyInstruction = input.strategyInstruction?.trim()
    ? `Strategy instruction: \"${input.strategyInstruction.trim()}\". Use this as an evaluation lens when evidence is mixed.`
    : "";

  return `Analyze ${input.ticker} (${input.asset}) for a ${dirWord} trade.
Direction: ${input.direction}. This is a ${dirWord} thesis.
Mode: ${input.mode}.
${dirRule}
${strategyContext}
${strategyInstruction}
Thesis: "${input.thesis}".
Setup types: ${setups}.
Conditions: ${conditions}.
Chart pattern: ${pattern}.
Search for current data and evaluate each criterion.

Metrics to evaluate:
${metricList}

Return ONLY valid JSON with each metric id as key:
{"${input.metrics[0]?.id}":{"v":"PASS","r":"one sentence reason"},...}
v must be exactly "PASS" or "FAIL". No other values.`;
}

export function buildInsightPrompt(
  ticker: string,
  direction: "LONG" | "SHORT",
  passed: string[],
  failed: string[],
  thesis: string,
): string {
  const objective = direction === "LONG" ? "upside continuation" : "downside continuation";

  return `You are evaluating a ${direction} trade on ${ticker}.
Thesis: "${thesis}".
Objective: ${objective}.

Passed criteria: ${passed.length ? passed.join(", ") : "none"}
Failed criteria: ${failed.length ? failed.join(", ") : "none"}

Return JSON only:
{"verdict":"GO|CAUTION|STOP","summary":"max 2 sentences","edge":"optional","risks":"optional"}
No markdown.`;
}

export function buildMoversPrompt(): string {
  return `Find today's notable US stock movers suitable for discretionary trading review.
Return 8-12 tickers with both gainers and losers.
Use delayed/publicly available context if needed.

Return JSON array only:
[{"ticker":"NVDA","name":"NVIDIA Corp","price":123.45,"change_pct":2.6,"volume":"52.1M","reason":"one sentence catalyst"}]
No markdown.`;
}

export function buildPricePrompt(ticker: string): string {
  return `Provide the latest approximate traded price for ${ticker} and an estimated daily percent change.
Return JSON only:
{"price":123.45,"pct":1.25}
No markdown.`;
}

export function buildRatingPrompt(mode: TradeMode, metricNames: string[]): string {
  return `Rate this ${mode} trading strategy metric stack.
Metrics: ${metricNames.join(", ")}.

Return JSON only:
{"score":0-100,"assessment":"short paragraph","missing":"comma-separated missing ideas","redundant":"comma-separated redundant ideas"}
No markdown.`;
}

export function buildThesisDraftPrompt(input: {
  ticker: string;
  direction: "LONG" | "SHORT";
  mode: string;
  strategyName: string;
  strategyInstruction?: string | null;
  setupTypes: string[];
  conditions: string[];
  chartPattern: string;
  invalidationStyle: string;
  assetClass: string;
  quotePrice: number | null;
}): string {
  const setups = input.setupTypes.length > 0 ? input.setupTypes.join(", ") : "No explicit setup types provided";
  const conditions = input.conditions.length > 0 ? input.conditions.join(", ") : "No explicit conditions provided";
  const pattern = input.chartPattern && input.chartPattern !== "None" ? input.chartPattern : "No dominant chart pattern";
  const strategyInstruction = input.strategyInstruction?.trim()
    ? `Strategy instruction: "${input.strategyInstruction.trim()}".`
    : "";
  const priceLine = input.quotePrice && Number.isFinite(input.quotePrice)
    ? `Current reference price: ${input.quotePrice.toFixed(2)}.`
    : "Current reference price unavailable; infer a reasonable stop framework from structure + volatility context.";

  return `Draft a concise ${input.direction} trade thesis for ${input.ticker} (${input.assetClass}).
Mode: ${input.mode}.
Strategy lane: ${input.strategyName}.
${strategyInstruction}
Preferred setup types: ${setups}.
Preferred conditions: ${conditions}.
Chart pattern: ${pattern}.
Invalidation style guidance: ${input.invalidationStyle || "Use clear structural invalidation."}.
${priceLine}

Return ONLY valid JSON:
{"thesis":"2-3 sentence thesis","catalystWindow":"short timing/catalyst phrase","invalidation":"explicit invalidation statement","suggestedStop":123.45,"stopReason":"one sentence explanation"}

Rules:
- suggestedStop must be numeric if feasible; otherwise use null.
- For LONG, suggestedStop should be below reference price when available.
- For SHORT, suggestedStop should be above reference price when available.
- No markdown, no extra keys.`;
}

export function buildOverrideAuditPrompt(input: {
  ticker: string;
  direction: "LONG" | "SHORT";
  strategyName: string;
  rulesBroken: string[];
  justification: string;
  overrideQuality: string;
}): string {
  const rules = input.rulesBroken.length > 0 ? input.rulesBroken.join("; ") : "General override";

  return `Audit this trading override justification for quality and coherence.

Ticker: ${input.ticker} (${input.direction})
Strategy: ${input.strategyName}
Rules broken: ${rules}
Override quality classification: ${input.overrideQuality}

Justification provided by the trader:
"${input.justification}"

Evaluate:
1. Does the justification address the specific broken rules?
2. Is the reasoning coherent and specific to this trade?
3. Does it show awareness of the risks being taken?

Return ONLY valid JSON:
{"quality":"valid|low_quality|high_risk","reasoning":"1-2 sentence assessment","flags":["optional array of concern tags"]}
No markdown.`;
}