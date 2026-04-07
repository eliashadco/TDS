import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export type AIProviderName = "anthropic" | "groq" | "gemini";
type AIProviderPreference = AIProviderName | "auto";

type AICompletionInput = {
  prompt: string;
  system: string;
  maxTokens: number;
  useWebSearch?: boolean;
};

type AICompletionResult = {
  provider: AIProviderName;
  model: string;
  text: string;
};

type AnthropicErrorShape = {
  status?: number;
  message?: string;
  error?: {
    error?: {
      message?: string;
    };
  };
};

type GroqResponseShape = {
  error?: {
    message?: string;
  };
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type GeminiResponseShape = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
};

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

class AIProviderRequestError extends Error {
  provider: AIProviderName;
  status?: number;

  constructor(provider: AIProviderName, message: string, status?: number) {
    super(message);
    this.provider = provider;
    this.status = status;
  }
}

function hasRealAnthropicKey(value: string | undefined): boolean {
  return /^sk-ant-/.test((value ?? "").trim());
}

function hasRealGroqKey(value: string | undefined): boolean {
  return /^gsk_/.test((value ?? "").trim());
}

function hasRealGeminiKey(value: string | undefined): boolean {
  return /^AIza/.test((value ?? "").trim());
}

function getProviderPreference(): AIProviderPreference {
  const value = (process.env.AI_PROVIDER ?? "auto").trim().toLowerCase();
  if (value === "anthropic" || value === "groq" || value === "gemini") {
    return value;
  }
  return "auto";
}

function resolveAnthropicModel(): string {
  const model = process.env.ANTHROPIC_MODEL?.trim();
  return model && model.length > 0 ? model : DEFAULT_ANTHROPIC_MODEL;
}

function resolveGroqModel(): string {
  const model = process.env.GROQ_MODEL?.trim();
  return model && model.length > 0 ? model : DEFAULT_GROQ_MODEL;
}

function resolveGeminiModel(): string {
  const model = process.env.GEMINI_MODEL?.trim();
  return model && model.length > 0 ? model : DEFAULT_GEMINI_MODEL;
}

export function resolveAIProviderConfig(): { provider: AIProviderName; model: string } {
  const preference = getProviderPreference();
  const hasAnthropic = hasRealAnthropicKey(process.env.ANTHROPIC_API_KEY);
  const hasGroq = hasRealGroqKey(process.env.GROQ_API_KEY);
  const hasGemini = hasRealGeminiKey(process.env.GEMINI_API_KEY);

  if (preference === "anthropic") {
    if (!hasAnthropic) {
      throw new AIProviderRequestError("anthropic", "AI_PROVIDER is set to anthropic but ANTHROPIC_API_KEY is not a valid key.", 500);
    }
    return { provider: "anthropic", model: resolveAnthropicModel() };
  }

  if (preference === "groq") {
    if (!hasGroq) {
      throw new AIProviderRequestError("groq", "AI_PROVIDER is set to groq but GROQ_API_KEY is not a valid key.", 500);
    }
    return { provider: "groq", model: resolveGroqModel() };
  }

  if (preference === "gemini") {
    if (!hasGemini) {
      throw new AIProviderRequestError("gemini", "AI_PROVIDER is set to gemini but GEMINI_API_KEY is not a valid key.", 500);
    }
    return { provider: "gemini", model: resolveGeminiModel() };
  }

  if (process.env.NODE_ENV !== "production" && hasGemini) {
    return { provider: "gemini", model: resolveGeminiModel() };
  }

  if (process.env.NODE_ENV !== "production" && hasGroq) {
    return { provider: "groq", model: resolveGroqModel() };
  }

  if (hasAnthropic) {
    return { provider: "anthropic", model: resolveAnthropicModel() };
  }

  if (hasGemini) {
    return { provider: "gemini", model: resolveGeminiModel() };
  }

  if (hasGroq) {
    return { provider: "groq", model: resolveGroqModel() };
  }

  throw new AIProviderRequestError(
    "gemini",
    "No AI provider is configured. Set GROQ_API_KEY or GEMINI_API_KEY for development, or ANTHROPIC_API_KEY for Anthropic.",
    500,
  );
}

function extractAnthropicMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "";
  }

  const candidate = error as AnthropicErrorShape;
  return candidate.error?.error?.message ?? candidate.message ?? "";
}

async function createAnthropicCompletion(input: AICompletionInput, model: string): Promise<AICompletionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!hasRealAnthropicKey(apiKey)) {
    throw new AIProviderRequestError("anthropic", "Anthropic API key is not configured.", 500);
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model,
      max_tokens: input.maxTokens,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
      ...(input.useWebSearch
        ? { tools: [{ type: "web_search_20250305", name: "web_search" } as never] }
        : {}),
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return { provider: "anthropic", model, text };
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;
    throw new AIProviderRequestError("anthropic", extractAnthropicMessage(error) || "Anthropic request failed.", status);
  }
}

async function createGroqCompletion(input: AICompletionInput, model: string): Promise<AICompletionResult> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!hasRealGroqKey(apiKey)) {
    throw new AIProviderRequestError("groq", "Groq API key is not configured.", 500);
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: input.maxTokens,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as GroqResponseShape | null;

  if (!response.ok) {
    throw new AIProviderRequestError("groq", payload?.error?.message ?? "Groq request failed.", response.status);
  }

  const text = payload?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new AIProviderRequestError("groq", "Groq returned an empty response.", 502);
  }

  return { provider: "groq", model, text };
}

async function createGeminiCompletion(input: AICompletionInput, model: string): Promise<AICompletionResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  if (!hasRealGeminiKey(apiKey)) {
    throw new AIProviderRequestError("gemini", "Gemini API key is not configured.", 500);
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: input.system }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: input.prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: input.maxTokens,
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as GeminiResponseShape | null;

  if (!response.ok) {
    throw new AIProviderRequestError("gemini", payload?.error?.message ?? "Gemini request failed.", response.status);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
  if (!text) {
    throw new AIProviderRequestError("gemini", "Gemini returned an empty response.", 502);
  }

  return { provider: "gemini", model, text };
}

export async function createAIJsonCompletion(input: AICompletionInput): Promise<AICompletionResult> {
  const config = resolveAIProviderConfig();
  if (config.provider === "anthropic") {
    return createAnthropicCompletion(input, config.model);
  }

  if (config.provider === "groq") {
    return createGroqCompletion(input, config.model);
  }

  try {
    return await createGeminiCompletion(input, config.model);
  } catch (error) {
    if (error instanceof AIProviderRequestError && hasRealGroqKey(process.env.GROQ_API_KEY)) {
      return createGroqCompletion(input, resolveGroqModel());
    }

    throw error;
  }
}

export function aiErrorResponse(error: unknown) {
  if (error instanceof AIProviderRequestError) {
    if (error.provider === "anthropic") {
      if (/credit balance is too low|upgrade or purchase credits/i.test(error.message)) {
        return NextResponse.json(
          {
            error:
              "Anthropic billing issue: the configured API key has no available credits. Add credits in Anthropic Plans & Billing and retry.",
          },
          { status: 503 },
        );
      }

      if (error.status === 401 || /invalid.*api key|authentication/i.test(error.message)) {
        return NextResponse.json(
          { error: "Anthropic authentication failed. Check the configured API key." },
          { status: 502 },
        );
      }

      if (error.status === 429 || /rate limit/i.test(error.message)) {
        return NextResponse.json(
          { error: "Anthropic rate limit reached. Retry shortly." },
          { status: 429 },
        );
      }
    }

    if (error.provider === "groq") {
      if (error.status === 401 || error.status === 403 || /invalid api key|authentication/i.test(error.message)) {
        return NextResponse.json(
          { error: "Groq authentication failed. Check the configured API key." },
          { status: 502 },
        );
      }

      if (error.status === 429 || /rate limit|quota/i.test(error.message)) {
        return NextResponse.json(
          { error: "Groq free-tier rate or quota limit reached. Retry shortly or switch providers." },
          { status: 429 },
        );
      }

      if (error.status === 400 && /model/i.test(error.message)) {
        return NextResponse.json(
          { error: "Groq model configuration is invalid. Check GROQ_MODEL in your environment." },
          { status: 502 },
        );
      }
    }

    if (error.provider === "gemini") {
      if (error.status === 400 && /model|not found/i.test(error.message)) {
        return NextResponse.json(
          { error: "Gemini model configuration is invalid. Check GEMINI_MODEL in your environment." },
          { status: 502 },
        );
      }

      if (error.status === 401 || error.status === 403 || /api key|permission|authentication/i.test(error.message)) {
        return NextResponse.json(
          { error: "Gemini authentication failed. Check the configured API key." },
          { status: 502 },
        );
      }

      if (error.status === 429 || /quota|rate limit|resource exhausted/i.test(error.message)) {
        return NextResponse.json(
          { error: "Gemini free-tier quota or rate limit reached. Retry shortly or switch providers." },
          { status: 429 },
        );
      }
    }

    return NextResponse.json({ error: error.message || "AI service unavailable" }, { status: error.status ?? 503 });
  }

  return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
}
