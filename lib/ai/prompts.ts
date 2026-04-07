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