import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { createServerSupabase } from "@/lib/supabase/server";
import { buildThesisDraftPrompt } from "@/lib/ai/prompts";
import { parseAIResponse } from "@/lib/ai/parser";
import { createAIJsonCompletion, resolveAIProviderConfig } from "@/lib/ai/provider";
import { getCached, setCache } from "@/lib/market/cache";
import { getCandles, getQuote } from "@/lib/market/polygon";
import { rateLimitAI, sanitizeText, sanitizeTicker } from "@/lib/api/security";
import { normalizeStrategyStructure } from "@/lib/trading/strategies";
import { buildStarterStructure } from "@/lib/trading/strategy-presets";
import { computeSmartStop } from "@/lib/trading/smart-stop";
import type { TradeMode } from "@/types/trade";

type ThesisDraftBody = {
  ticker: string;
  direction: "LONG" | "SHORT";
  strategyId: string;
  assetClass?: string;
};

type ThesisDraftAI = {
  thesis?: string;
  catalystWindow?: string;
  invalidation?: string;
  suggestedStop?: number | null;
  stopReason?: string;
};

function buildCacheKey(input: {
  provider: string;
  model: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  strategyId: string;
}): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return `thesis-draft:${digest}`;
}

function formatDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export async function POST(req: NextRequest) {
  try {
    const limit = await rateLimitAI(req, "ai:thesis-draft");
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } },
      );
    }

    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as ThesisDraftBody;
    const ticker = sanitizeTicker(body.ticker);
    const strategyId = sanitizeText(body.strategyId, 64);
    const direction = body.direction === "LONG" || body.direction === "SHORT" ? body.direction : null;
    const assetClass = sanitizeText(body.assetClass ?? "Equity", 40) || "Equity";

    if (!ticker || !strategyId || !direction) {
      return NextResponse.json({ error: "ticker, direction, and strategyId are required" }, { status: 400 });
    }

    const { data: strategy, error: strategyError } = await supabase
      .from("user_strategies")
      .select("id, name, mode, ai_instruction, active_version_id")
      .eq("id", strategyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (strategyError) throw strategyError;
    if (!strategy) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }

    let versionSnapshot: Record<string, unknown> = {};
    if (strategy.active_version_id) {
      const { data: versionRow } = await supabase
        .from("strategy_versions")
        .select("snapshot")
        .eq("id", strategy.active_version_id)
        .maybeSingle();
      if (versionRow?.snapshot && typeof versionRow.snapshot === "object") {
        versionSnapshot = versionRow.snapshot as Record<string, unknown>;
      }
    }

    const mode = (strategy.mode ?? "swing") as TradeMode;
    const fallbackStructure = buildStarterStructure(mode);
    const structure = normalizeStrategyStructure(versionSnapshot.structure ?? {}, fallbackStructure);

    const quote = await getQuote(ticker);
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 70);
    const candles = await getCandles(ticker, formatDate(from), formatDate(to), "day");
    const computedStop = computeSmartStop({
      direction,
      quotePrice: quote?.price ?? null,
      candles,
    });

    const providerConfig = resolveAIProviderConfig();
    const cacheKey = buildCacheKey({
      provider: providerConfig.provider,
      model: providerConfig.model,
      ticker,
      direction,
      strategyId,
    });

    const cached = getCached<{
      thesis: string;
      catalystWindow: string;
      invalidation: string;
      suggestedStop: number | null;
      stopReason: string | null;
      quotePrice: number | null;
      generatedAt: string;
    }>(cacheKey);

    if (cached) {
      return NextResponse.json(cached);
    }

    const prompt = buildThesisDraftPrompt({
      ticker,
      direction,
      mode,
      strategyName: strategy.name,
      strategyInstruction: strategy.ai_instruction,
      setupTypes: structure.setupTypes,
      conditions: structure.conditions,
      chartPattern: structure.chartPattern,
      invalidationStyle: structure.invalidationStyle,
      assetClass,
      quotePrice: quote?.price ?? null,
    });

    let aiDraft: ThesisDraftAI | null = null;
    let completionMeta: { provider: string; model: string } | null = null;

    try {
      const completion = await createAIJsonCompletion({
        prompt,
        system: "Trading strategist. Respond ONLY in valid JSON. No markdown, no preamble.",
        maxTokens: 900,
        useWebSearch: true,
      });

      completionMeta = { provider: completion.provider, model: completion.model };
      aiDraft = parseAIResponse<ThesisDraftAI>(completion.text);
    } catch {
      aiDraft = null;
      completionMeta = null;
    }

    const setupLabel = structure.setupTypes.slice(0, 2).join(" + ") || "price-structure continuation";
    const conditionLabel = structure.conditions.slice(0, 2).join(" and ") || "trend alignment";
    const fallbackThesis = direction === "LONG"
      ? `${ticker} is a ${setupLabel} long setup under ${strategy.name}, with ${conditionLabel} supporting continuation. Execute only while structure holds and momentum confirms above trigger zones.`
      : `${ticker} is a ${setupLabel} short setup under ${strategy.name}, with ${conditionLabel} supporting downside continuation. Execute only while structure stays weak and failed reclaim attempts persist.`;

    const thesis = sanitizeText(aiDraft?.thesis ?? fallbackThesis, 1200);
    const catalystWindow = sanitizeText(
      aiDraft?.catalystWindow ?? "Next 1-3 sessions around trend continuation confirmation and volume follow-through.",
      200,
    );
    const invalidation = sanitizeText(
      aiDraft?.invalidation ?? structure.invalidationStyle ?? "Exit on structure break against thesis direction.",
      240,
    );

    const aiStop = asNumberOrNull(aiDraft?.suggestedStop);
    const referencePrice = computedStop.referencePrice;

    let suggestedStop: number | null = aiStop;
    if (suggestedStop != null && referencePrice != null) {
      if ((direction === "LONG" && suggestedStop >= referencePrice) || (direction === "SHORT" && suggestedStop <= referencePrice)) {
        suggestedStop = null;
      }
    }

    if (suggestedStop == null) {
      suggestedStop = computedStop.suggestedStop;
    }

    const stopReason =
      sanitizeText(aiDraft?.stopReason ?? "", 220) ||
      computedStop.rationale;

    const payload = {
      thesis,
      catalystWindow,
      invalidation,
      suggestedStop,
      stopReason,
      draftSource: aiDraft ? "ai" : "fallback",
      quotePrice: quote?.price ?? null,
      generatedAt: new Date().toISOString(),
    };

    setCache(cacheKey, payload, 60 * 60 * 1000);

    return NextResponse.json(
      payload,
      completionMeta
        ? {
            headers: {
              "X-AI-Provider": completionMeta.provider,
              "X-AI-Model": completionMeta.model,
            },
          }
        : undefined,
    );
  } catch (error) {
    console.error("AI thesis draft error:", error);

    const fallback = {
      thesis: "Draft unavailable. Build a concise thesis around setup, confirmation, and invalidation.",
      catalystWindow: "Next 1-3 sessions.",
      invalidation: "Exit when market structure invalidates the thesis direction.",
      suggestedStop: null,
      stopReason: "Fallback response due to temporary AI/provider failure.",
      draftSource: "fallback",
      quotePrice: null,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(fallback);
  }
}
