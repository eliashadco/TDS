import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { buildAssessmentPrompt } from "@/lib/ai/prompts";
import { parseAIResponse } from "@/lib/ai/parser";
import { aiErrorResponse, createAIJsonCompletion, resolveAIProviderConfig } from "@/lib/ai/provider";
import { getCached, setCache } from "@/lib/market/cache";
import { rateLimitAI, sanitizeStringArray, sanitizeText, sanitizeTicker } from "@/lib/api/security";

type AssessMetric = { id: string; name: string; desc: string };

type AssessBody = {
  ticker: string;
  direction: "LONG" | "SHORT";
  thesis: string;
  setups: string[];
  conditions?: string[];
  chartPattern?: string;
  asset: string;
  mode?: string;
  strategyName?: string;
  strategyInstruction?: string | null;
  metrics: AssessMetric[];
};

function buildAssessmentCacheKey(input: {
  provider: string;
  model: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  thesis: string;
  asset: string;
  mode: string;
  setups: string[];
  conditions: string[];
  chartPattern: string;
  strategyName: string;
  strategyInstruction: string;
  metrics: AssessMetric[];
}): string {
  const stablePayload = {
    provider: input.provider,
    model: input.model,
    ticker: input.ticker,
    direction: input.direction,
    thesis: input.thesis,
    asset: input.asset,
    mode: input.mode,
    setups: [...input.setups].sort(),
    conditions: [...input.conditions].sort(),
    chartPattern: input.chartPattern,
    strategyName: input.strategyName,
    strategyInstruction: input.strategyInstruction,
    metrics: [...input.metrics]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((metric) => ({ id: metric.id, name: metric.name, desc: metric.desc })),
  };

  const digest = createHash("sha256").update(JSON.stringify(stablePayload)).digest("hex");
  return `assess:${digest}`;
}

export async function POST(req: NextRequest) {
  try {
    const limit = await rateLimitAI(req, "ai:assess");
    if (!limit.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } });
    }

    const body = (await req.json()) as AssessBody;
    const direction = body.direction;
    const ticker = sanitizeTicker(body.ticker);
    const thesis = sanitizeText(body.thesis, 1200);
    const asset = sanitizeText(body.asset, 40);
    const setups = sanitizeStringArray(body.setups, 20, 50);
    const conditions = sanitizeStringArray(body.conditions ?? [], 20, 50);
    const chartPattern = sanitizeText(body.chartPattern ?? "None", 80);
    const mode = sanitizeText(body.mode ?? "unknown", 20);
    const strategyName = sanitizeText(body.strategyName ?? "", 120);
    const strategyInstruction = sanitizeText(body.strategyInstruction ?? "", 600);
    const metrics = Array.isArray(body.metrics)
      ? body.metrics.slice(0, 80).map((metric) => ({
          id: sanitizeText(metric?.id, 40),
          name: sanitizeText(metric?.name, 80),
          desc: sanitizeText(metric?.desc, 220),
        })).filter((metric) => metric.id && metric.name)
      : [];

    if (!ticker || !direction || !thesis || !asset || !Array.isArray(setups) || !Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const providerConfig = resolveAIProviderConfig();

    const cacheKey = buildAssessmentCacheKey({
      provider: providerConfig.provider,
      model: providerConfig.model,
      ticker: ticker.toUpperCase(),
      direction,
      thesis,
      asset,
      mode,
      setups,
      conditions,
      chartPattern,
      strategyName,
      strategyInstruction,
      metrics,
    });
    const cached = getCached<Record<string, { v: "PASS" | "FAIL"; r: string }>>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const prompt = buildAssessmentPrompt({
      ticker: ticker.toUpperCase(),
      direction,
      thesis,
      setups,
      conditions,
      chartPattern,
      asset,
      mode,
      strategyName,
      strategyInstruction,
      metrics,
    });

    const completion = await createAIJsonCompletion({
      prompt,
      system: "Trading analyst. Respond ONLY in valid JSON. No markdown, no preamble, no backticks.",
      maxTokens: 1500,
      useWebSearch: true,
    });

    const parsed = parseAIResponse<Record<string, { v: "PASS" | "FAIL"; r: string }>>(completion.text);
    if (!parsed) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    setCache(cacheKey, parsed, 4 * 60 * 60 * 1000);
    return NextResponse.json(parsed, { headers: { "X-AI-Provider": completion.provider, "X-AI-Model": completion.model } });
  } catch (error) {
    console.error("AI assess error:", error);
    return aiErrorResponse(error);
  }
}