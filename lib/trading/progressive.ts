import type { DisciplineProfile } from "@/types/trade";

/* ---------- Experience tiers (TRD v2 §14.3) ---------- */

export type ExperienceTier = "beginner" | "intermediate" | "advanced" | "expert";

export interface ExperienceStatus {
  tier: ExperienceTier;
  tradeCount: number;
  nextTier: ExperienceTier | null;
  tradesUntilNext: number;
  unlockedFeatures: string[];
}

const TIER_THRESHOLDS: Array<{ tier: ExperienceTier; minTrades: number }> = [
  { tier: "beginner", minTrades: 0 },
  { tier: "intermediate", minTrades: 10 },
  { tier: "advanced", minTrades: 50 },
  { tier: "expert", minTrades: 150 },
];

const FEATURE_UNLOCKS: Record<ExperienceTier, string[]> = {
  beginner: ["Trade wizard", "Learn mode", "Guided structure picker"],
  intermediate: ["AI thesis draft", "AI insight", "Compatibility scoring"],
  advanced: ["Balanced discipline profile", "Override system", "Circuit breaker override"],
  expert: ["Expert discipline profile", "Fast execution", "Strategy branching"],
};

/**
 * Compute experience tier from total trade count.
 * Features unlock progressively as the user completes more trades.
 */
export function computeExperience(tradeCount: number): ExperienceStatus {
  let currentTier: ExperienceTier = "beginner";

  for (const { tier, minTrades } of TIER_THRESHOLDS) {
    if (tradeCount >= minTrades) {
      currentTier = tier;
    }
  }

  const currentIdx = TIER_THRESHOLDS.findIndex((t) => t.tier === currentTier);
  const nextEntry = TIER_THRESHOLDS[currentIdx + 1] ?? null;

  const unlockedFeatures: string[] = [];
  for (const { tier, minTrades } of TIER_THRESHOLDS) {
    if (tradeCount >= minTrades) {
      unlockedFeatures.push(...FEATURE_UNLOCKS[tier]);
    }
  }

  return {
    tier: currentTier,
    tradeCount,
    nextTier: nextEntry?.tier ?? null,
    tradesUntilNext: nextEntry ? Math.max(0, nextEntry.minTrades - tradeCount) : 0,
    unlockedFeatures,
  };
}

/**
 * Check if a discipline profile is available for the user's experience level.
 * Prevents beginners from accessing expert mode.
 */
export function isProfileUnlocked(profile: DisciplineProfile, tradeCount: number): boolean {
  switch (profile) {
    case "strict":
      return true; // always available
    case "balanced":
      return tradeCount >= 50; // advanced tier
    case "expert":
      return tradeCount >= 150; // expert tier
  }
}

/* ---------- Ambient nudge system ---------- */

export type NudgeType = "info" | "warning" | "success";

export interface AmbientNudge {
  id: string;
  type: NudgeType;
  message: string;
}

/**
 * Generate contextual nudges based on user behavior patterns.
 * These are non-blocking suggestions shown in the trade wizard sidebar.
 */
export function generateNudges(stats: {
  tradeCount: number;
  overrideCount: number;
  inPolicyCount: number;
  consecutiveLosses: number;
  disciplineScore: number | null;
  circuitBreakerTripped: boolean;
}): AmbientNudge[] {
  const nudges: AmbientNudge[] = [];

  // High override ratio
  if (stats.tradeCount >= 5 && stats.overrideCount > 0) {
    const overrideRatio = stats.overrideCount / stats.tradeCount;
    if (overrideRatio > 0.4) {
      nudges.push({
        id: "high-override-ratio",
        type: "warning",
        message: `${Math.round(overrideRatio * 100)}% of your trades are overrides. Consider adjusting your strategy rules to match your actual trading style.`,
      });
    }
  }

  // Losing streak
  if (stats.consecutiveLosses >= 2) {
    nudges.push({
      id: "losing-streak",
      type: "warning",
      message: `${stats.consecutiveLosses} consecutive losses. Take a moment to review your recent entries before the next trade.`,
    });
  }

  // Discipline score declining
  if (stats.disciplineScore !== null && stats.disciplineScore < 50) {
    nudges.push({
      id: "low-discipline",
      type: "warning",
      message: "Your discipline score is below 50. Focus on in-policy trades to rebuild consistency.",
    });
  }

  // Perfect compliance streak
  if (stats.tradeCount >= 5 && stats.overrideCount === 0) {
    nudges.push({
      id: "perfect-compliance",
      type: "success",
      message: "Perfect discipline — all trades in policy. Strong execution consistency.",
    });
  }

  // Circuit breaker active
  if (stats.circuitBreakerTripped) {
    nudges.push({
      id: "circuit-breaker-active",
      type: "warning",
      message: "Circuit breaker is active. Review your strategy before deploying new trades.",
    });
  }

  // New user encouragement
  if (stats.tradeCount < 5) {
    nudges.push({
      id: "new-user",
      type: "info",
      message: `${5 - stats.tradeCount} more trade${5 - stats.tradeCount !== 1 ? "s" : ""} to build your first performance baseline.`,
    });
  }

  return nudges;
}
