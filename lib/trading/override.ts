import type { OverrideQuality, DisciplineProfile } from "@/types/trade";

/* ---------- Justification validation (TRD v2 §9.3) ---------- */

export interface JustificationResult {
  valid: boolean;
  wordCount: number;
  uniqueRatio: number;
  reason: string | null;
}

const MIN_WORD_COUNT = 8;
const MIN_UNIQUE_WORD_RATIO = 0.5;

export function validateJustification(text: string): JustificationResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { valid: false, wordCount: 0, uniqueRatio: 0, reason: "Justification is required." };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount < MIN_WORD_COUNT) {
    return {
      valid: false,
      wordCount,
      uniqueRatio: 0,
      reason: `Minimum ${MIN_WORD_COUNT} words required (${wordCount} provided).`,
    };
  }

  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const uniqueRatio = uniqueWords.size / wordCount;

  if (uniqueRatio < MIN_UNIQUE_WORD_RATIO) {
    return {
      valid: false,
      wordCount,
      uniqueRatio,
      reason: `Too many repeated words. Unique word ratio: ${(uniqueRatio * 100).toFixed(0)}% (minimum ${MIN_UNIQUE_WORD_RATIO * 100}%).`,
    };
  }

  return { valid: true, wordCount, uniqueRatio, reason: null };
}

/* ---------- Override classification (TRD v2 §9.4) ---------- */

export interface OverrideClassificationInput {
  justification: string;
  /** Current portfolio drawdown percentage (0-100). */
  drawdownPct: number;
  /** Number of consecutive losing trades. */
  consecutiveLosses: number;
}

/**
 * Classify an override as valid, low_quality, or high_risk.
 * - high_risk: during drawdown > 5% or consecutive losses ≥ 3
 * - low_quality: justification passes minimum but is borderline
 * - valid: everything looks acceptable
 */
export function classifyOverride(input: OverrideClassificationInput): OverrideQuality {
  // High-risk conditions take priority
  if (input.drawdownPct > 5 || input.consecutiveLosses >= 3) {
    return "high_risk";
  }

  const validation = validateJustification(input.justification);
  if (!validation.valid) {
    return "low_quality";
  }

  // Borderline quality — short or low unique ratio
  if (validation.wordCount < 12 || validation.uniqueRatio < 0.6) {
    return "low_quality";
  }

  return "valid";
}

/* ---------- Friction timer by discipline profile (TRD v2 §4.1) ---------- */

export function getTimerDuration(profile: DisciplineProfile): number {
  switch (profile) {
    case "strict":
      return 30;
    case "balanced":
      return 15;
    case "expert":
      return 0;
  }
}

/* ---------- Broken rules extraction ---------- */

/**
 * Extract which gate rules were broken from the gate result reason.
 * Returns a list of human-readable rule descriptions.
 */
export function extractBrokenRules(
  gateAction: "proceed" | "watchlist" | "blocked",
  gateReason: string | null,
  fScore: number,
  fTotal: number,
  tScore: number,
  tTotal: number,
): string[] {
  const rules: string[] = [];

  if (gateAction === "blocked" || gateAction === "watchlist") {
    const fMin = Math.max(1, Math.ceil(fTotal * 0.7));
    if (fScore < fMin) {
      rules.push(`Fundamental gate failed (${fScore}/${fMin} required)`);
    }
    if (tScore < tTotal) {
      rules.push(`Technical gate failed (${tScore}/${tTotal} required)`);
    }
  }

  if (rules.length === 0 && gateReason) {
    rules.push(gateReason);
  }

  return rules;
}
