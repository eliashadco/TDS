import { NextResponse } from "next/server";

type AnthropicErrorShape = {
  status?: number;
  message?: string;
  error?: {
    error?: {
      message?: string;
      type?: string;
    };
  };
};

function extractAnthropicMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "";
  }

  const candidate = error as AnthropicErrorShape;
  return candidate.error?.error?.message ?? candidate.message ?? "";
}

export function anthropicErrorResponse(error: unknown) {
  const message = extractAnthropicMessage(error);
  const status =
    error && typeof error === "object" && "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;

  if (/credit balance is too low|upgrade or purchase credits/i.test(message)) {
    return NextResponse.json(
      {
        error:
          "Anthropic billing issue: the configured API key has no available credits. Add credits in Anthropic Plans & Billing and retry.",
      },
      { status: 503 },
    );
  }

  if (status === 401 || /invalid.*api key|authentication/i.test(message)) {
    return NextResponse.json(
      { error: "Anthropic authentication failed. Check the configured API key." },
      { status: 502 },
    );
  }

  if (status === 429 || /rate limit/i.test(message)) {
    return NextResponse.json(
      { error: "Anthropic rate limit reached. Retry shortly." },
      { status: 429 },
    );
  }

  return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
}