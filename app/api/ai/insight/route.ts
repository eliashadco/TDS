import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { buildInsightPrompt } from "@/lib/ai/prompts";
import { parseAIResponse } from "@/lib/ai/parser";
import { aiErrorResponse, createAIJsonCompletion } from "@/lib/ai/provider";
import { rateLimitAI, sanitizeStringArray, sanitizeText, sanitizeTicker } from "@/lib/api/security";

type InsightBody = {
  ticker: string;
  direction: "LONG" | "SHORT";
  passed: string[];
  failed: string[];
  thesis: string;
};

export async function POST(req: NextRequest) {
  try {
    const limit = await rateLimitAI(req, "ai:insight");
    if (!limit.ok) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec ?? 60) } });
    }

    const body = (await req.json()) as InsightBody;
    const direction = body.direction;
    const ticker = sanitizeTicker(body.ticker);
    const thesis = sanitizeText(body.thesis, 1000);
    const passed = sanitizeStringArray(body.passed, 80, 100);
    const failed = sanitizeStringArray(body.failed, 80, 100);

    if (!ticker || !direction || !Array.isArray(passed) || !Array.isArray(failed) || !thesis) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const prompt = buildInsightPrompt(ticker.toUpperCase(), direction, passed, failed, thesis);
    const completion = await createAIJsonCompletion({
      prompt,
      system: "Trading analyst. Respond ONLY in valid JSON. No markdown.",
      maxTokens: 800,
      useWebSearch: true,
    });

    const parsed = parseAIResponse<{ verdict: "GO" | "CAUTION" | "STOP"; summary: string; edge?: string; risks?: string }>(completion.text);
    if (!parsed) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    return NextResponse.json(parsed, { headers: { "X-AI-Provider": completion.provider, "X-AI-Model": completion.model } });
  } catch (error) {
    console.error("AI insight error:", error);
    return aiErrorResponse(error);
  }
}