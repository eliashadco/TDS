import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { buildRatingPrompt } from "@/lib/ai/prompts";
import { parseAIResponse } from "@/lib/ai/parser";
import { aiErrorResponse, createAIJsonCompletion } from "@/lib/ai/provider";
import type { TradeMode } from "@/types/trade";
import { rateLimitAI, sanitizeStringArray, sanitizeText } from "@/lib/api/security";

type RateBody = {
  mode: TradeMode;
  metrics: string[];
};

export async function POST(req: NextRequest) {
  try {
    const limit = await rateLimitAI(req, "ai:rate");
    if (!limit.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } });
    }

    const body = (await req.json()) as RateBody;
    const mode = sanitizeText(body?.mode, 20) as TradeMode;
    const metrics = sanitizeStringArray(body?.metrics, 80, 80);
    if (!mode || metrics.length === 0) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const prompt = buildRatingPrompt(mode, metrics);
    const completion = await createAIJsonCompletion({
      prompt,
      system: "Trading strategist. Respond ONLY in valid JSON. No markdown.",
      maxTokens: 600,
      useWebSearch: true,
    });

    const parsed = parseAIResponse<{ score: number; assessment: string; missing?: string; redundant?: string }>(completion.text);
    if (!parsed || typeof parsed.score !== "number" || typeof parsed.assessment !== "string") {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    return NextResponse.json(parsed, { headers: { "X-AI-Provider": completion.provider, "X-AI-Model": completion.model } });
  } catch (error) {
    console.error("AI rate error:", error);
    return aiErrorResponse(error);
  }
}