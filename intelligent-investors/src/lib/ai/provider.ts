import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

function extractText(response: { text?: string }): string {
  if (!response.text) throw new Error("Empty AI response");
  return response.text;
}

export async function scoreThesis(prompt: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          metrics: {
            type: Type.OBJECT,
            additionalProperties: {
              type: Type.OBJECT,
              properties: {
                passed: { type: Type.BOOLEAN },
                score: { type: Type.NUMBER },
                reasoning: { type: Type.STRING }
              },
              required: ["passed", "score", "reasoning"]
            }
          },
          verdict: { type: Type.STRING, enum: ["PASS", "FAIL", "CAUTION"] },
          fundamentalScore: { type: Type.NUMBER },
          technicalScore: { type: Type.NUMBER },
          summary: { type: Type.STRING },
          edge: { type: Type.STRING },
          risks: { type: Type.STRING }
        },
        required: ["metrics", "verdict", "fundamentalScore", "technicalScore", "summary", "edge", "risks"]
      }
    }
  });

  return JSON.parse(extractText(response));
}

export async function generateInsight(assessment: any) {
  const prompt = `
    Summarize the following trade assessment into a concise operational brief.
    Focus on the "Edge" and "Key Risks".
    
    Assessment: ${JSON.stringify(assessment)}
    
    Return a JSON object with:
    {
      "summary": "One sentence summary",
      "edge": "The primary reason this trade has an edge",
      "risks": "The most critical risk to watch"
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          edge: { type: Type.STRING },
          risks: { type: Type.STRING }
        },
        required: ["summary", "edge", "risks"]
      }
    }
  });

  return JSON.parse(extractText(response));
}

export async function rateStrategy(strategy: any) {
  const prompt = `
    Rate the following trading strategy for coherence and completeness.
    Strategy: ${JSON.stringify(strategy)}
    
    Return a JSON object with:
    {
      "score": number (1-10),
      "feedback": "Detailed feedback on the strategy structure",
      "suggestions": ["List of improvements"]
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["score", "feedback", "suggestions"]
      }
    }
  });

  return JSON.parse(extractText(response));
}
