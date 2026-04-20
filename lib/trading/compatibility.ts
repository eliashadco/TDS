import type { ConvictionTier, Metric, TradeScores } from "@/types/trade";
import type { GateResult } from "@/lib/trading/validation";

/* ---------- Result shape ---------- */

export interface CompatibilityResult {
  /** The ticker symbol assessed. */
  ticker: string;
  /** The strategy the ticker was assessed against. */
  strategyId: string;
  /** Trade direction used for the assessment. */
  direction: "LONG" | "SHORT";
  /** Binary metric scores: 1 = PASS, 0 = FAIL */
  scores: TradeScores;
  /** Number of fundamental metrics that passed. */
  fundamentalScore: number;
  /** Total enabled fundamental metrics. */
  fundamentalTotal: number;
  /** Number of technical metrics that passed. */
  technicalScore: number;
  /** Total enabled technical metrics. */
  technicalTotal: number;
  /** Conviction tier if gates pass, otherwise null. */
  conviction: ConvictionTier | null;
  /** Full gate evaluation result (proceed/watchlist/blocked). */
  gateResult: GateResult;
  /** All enabled metrics for this strategy (ordered by sort_order). */
  metrics: Metric[];
  /** Raw AI assess output — metric id → { v: PASS|FAIL, r: reason }. */
  aiScores: Record<string, { v: "PASS" | "FAIL"; r: string }>;
  /** Suggested stop price from volatility-aware smart-stop logic. */
  suggestedStop: number | null;
  /** Reasoning for the current smart-stop output. */
  suggestedStopReason: string | null;
  /** ISO timestamp when this result was computed. */
  cachedAt: string;
}

/* ---------- Pure scoring helper ---------- */

/**
 * Convert raw AI assess output into `TradeScores` + per-gate totals.
 *
 * Pure function — no I/O. Reusable across API routes and client components.
 * Any metric id absent from `aiScores` is treated as FAIL (score = 0).
 */
export function scoreFromAIResponse(
  aiScores: Record<string, { v: "PASS" | "FAIL"; r: string }>,
  fundamentalMetrics: Metric[],
  technicalMetrics: Metric[],
): {
  scores: TradeScores;
  fundamentalScore: number;
  technicalScore: number;
} {
  const scores: TradeScores = {};

  for (const metric of [...fundamentalMetrics, ...technicalMetrics]) {
    const entry = aiScores[metric.id];
    scores[metric.id] = entry?.v === "PASS" ? 1 : 0;
  }

  const fundamentalScore = fundamentalMetrics.reduce((sum, m) => sum + (scores[m.id] ?? 0), 0);
  const technicalScore = technicalMetrics.reduce((sum, m) => sum + (scores[m.id] ?? 0), 0);

  return { scores, fundamentalScore, technicalScore };
}
