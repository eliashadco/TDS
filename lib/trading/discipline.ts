import type { TradeClassification, Override, OverrideQuality } from "@/types/trade";

/* ---------- Trade classification ---------- */

/**
 * Classify a trade based on gate result and override status.
 * TRD v2 §10.2
 */
export function classifyTrade(
  gatePassed: boolean,
  overridden: boolean,
): TradeClassification {
  if (gatePassed) return "in_policy";
  if (overridden) return "override";
  return "out_of_bounds";
}

/* ---------- Discipline score computation ---------- */

export interface DisciplineScoreInput {
  trades: Array<{
    classification: TradeClassification;
    state: string;
  }>;
  overrides: Array<{
    quality_flag: OverrideQuality;
  }>;
}

/**
 * Compute discipline score (0–100).
 * TRD v2 §10.1
 *
 * Factors:
 * - Base: % of in-policy trades (70% weight)
 * - Override penalty: each override -5, low-quality -8, high-risk -12 (20% weight)
 * - Consistency bonus: 0 overrides in period = +10 (10% weight)
 */
export function computeDisciplineScore(input: DisciplineScoreInput): number {
  const { trades, overrides } = input;

  if (trades.length === 0) return 100;

  // 1. In-policy ratio (70% weight)
  const inPolicyCount = trades.filter((t) => t.classification === "in_policy").length;
  const inPolicyRatio = inPolicyCount / trades.length;
  const ratioScore = inPolicyRatio * 70;

  // 2. Override penalty (20% weight, deducted from 20)
  let overridePenalty = 0;
  for (const o of overrides) {
    if (o.quality_flag === "high_risk") overridePenalty += 12;
    else if (o.quality_flag === "low_quality") overridePenalty += 8;
    else overridePenalty += 5;
  }
  const overrideScore = Math.max(0, 20 - overridePenalty);

  // 3. Consistency bonus (10% weight)
  const consistencyScore = overrides.length === 0 ? 10 : 0;

  return Math.round(Math.min(100, Math.max(0, ratioScore + overrideScore + consistencyScore)));
}

/* ---------- Weekly summary ---------- */

export interface WeeklySummary {
  totalTrades: number;
  inPolicyCount: number;
  overrideCount: number;
  oobCount: number;
  pnlInPolicy: number;
  pnlOverride: number;
  pnlOob: number;
  disciplineScore: number;
  periodStart: string;
  periodEnd: string;
}

export interface TradePnlInfo {
  classification: TradeClassification;
  state: string;
  entry_price: number | null;
  exit_price: number | null;
  direction: "LONG" | "SHORT";
}

function computeTradePnlPct(t: TradePnlInfo): number {
  if (!t.entry_price || !t.exit_price || t.entry_price === 0) return 0;
  const raw = t.direction === "LONG"
    ? (t.exit_price - t.entry_price) / t.entry_price
    : (t.entry_price - t.exit_price) / t.entry_price;
  return raw * 100;
}

/**
 * Build weekly summary from trades and overrides.
 * TRD v2 §10.3
 */
export function buildWeeklySummary(
  trades: TradePnlInfo[],
  overrides: Array<Pick<Override, "quality_flag">>,
  periodStart: string,
  periodEnd: string,
): WeeklySummary {
  let inPolicyCount = 0;
  let overrideCount = 0;
  let oobCount = 0;
  let pnlInPolicy = 0;
  let pnlOverride = 0;
  let pnlOob = 0;

  for (const trade of trades) {
    const pnl = computeTradePnlPct(trade);

    switch (trade.classification) {
      case "in_policy":
        inPolicyCount++;
        pnlInPolicy += pnl;
        break;
      case "override":
        overrideCount++;
        pnlOverride += pnl;
        break;
      case "out_of_bounds":
        oobCount++;
        pnlOob += pnl;
        break;
    }
  }

  const disciplineScore = computeDisciplineScore({
    trades: trades.map((t) => ({ classification: t.classification, state: t.state })),
    overrides: overrides.map((o) => ({ quality_flag: o.quality_flag })),
  });

  return {
    totalTrades: trades.length,
    inPolicyCount,
    overrideCount,
    oobCount,
    pnlInPolicy,
    pnlOverride,
    pnlOob,
    disciplineScore,
    periodStart,
    periodEnd,
  };
}

/**
 * Get the start and end dates for the current ISO week.
 */
export function getCurrentWeekRange(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
  };
}

/* ---------- Hypothetical P&L without overrides ---------- */

export interface HypotheticalPnlResult {
  /** Actual cumulative P&L % across all closed trades */
  actualPnlPct: number;
  /** Hypothetical P&L % if all override trades were excluded */
  withoutOverridesPnlPct: number;
  /** How much the override trades cost (positive = overrides helped, negative = overrides hurt) */
  overrideImpactPct: number;
  /** Number of closed override trades in the dataset */
  overrideTradeCount: number;
}

/**
 * Compute hypothetical P&L if the user had never overridden.
 * Used by the Accountability Mirror in the override flow.
 */
export function computeHypotheticalPnl(
  trades: TradePnlInfo[],
): HypotheticalPnlResult {
  let actualPnlPct = 0;
  let inPolicyPnlPct = 0;
  let overrideTradeCount = 0;

  for (const trade of trades) {
    const pnl = computeTradePnlPct(trade);
    actualPnlPct += pnl;

    if (trade.classification === "override" || trade.classification === "out_of_bounds") {
      overrideTradeCount++;
    } else {
      inPolicyPnlPct += pnl;
    }
  }

  return {
    actualPnlPct,
    withoutOverridesPnlPct: inPolicyPnlPct,
    overrideImpactPct: actualPnlPct - inPolicyPnlPct,
    overrideTradeCount,
  };
}
