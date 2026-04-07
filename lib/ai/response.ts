export type AIResponseMeta = {
  provider: "anthropic" | "groq" | "gemini";
  model?: string;
};

export function extractAIResponseMeta(response: Response): AIResponseMeta | null {
  const provider = response.headers.get("X-AI-Provider");
  if (provider !== "anthropic" && provider !== "groq" && provider !== "gemini") {
    return null;
  }

  const model = response.headers.get("X-AI-Model")?.trim();
  return {
    provider,
    model: model && model.length > 0 ? model : undefined,
  };
}
