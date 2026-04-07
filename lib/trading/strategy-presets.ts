import { buildMetricsForMode, getMetricDefinition } from "@/lib/trading/presets";
import type { Metric, TradeMode } from "@/types/trade";
import type { StrategyPresetDefinition, StrategyStructureSnapshot } from "@/types/strategy";

function formatModeLabel(mode: TradeMode): string {
  if (mode === "daytrade") {
    return "Day Trade";
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export const STRATEGY_PRESETS: StrategyPresetDefinition[] = [
  {
    key: "conservative-swing-long",
    mode: "swing",
    name: "Conservative Swing Long",
    description: "Quality and valuation support blended with trend confirmation for cleaner multi-day continuation.",
    learningGoal: "Practice aligning durable fundamentals with technical confirmation before pressing size.",
    whenNotToUse: "Avoid during low-liquidity squeezes, event-risk gaps, or when the trade depends on pure intraday speed.",
    sizingNotes: "Default to HIGH or STD conviction unless both trend and volume confirm through the trigger.",
    walkthrough: "Wait for pullback support, confirm trend resumption, then score the name only if both quality and price structure stay aligned.",
    invalidationStyle: "Break below trend support or lose the reclaim zone that triggered the setup.",
    setupTypes: ["Pullback", "Trend Continuation"],
    conditions: ["Relative Strength", "Volume Confirmation"],
    chartPattern: "Flag",
    metricIds: ["f_roe", "f_margin", "f_fcf", "f_val", "f_debt", "t_trend", "t_rs", "t_vol"],
  },
  {
    key: "earnings-momentum-continuation",
    mode: "swing",
    name: "Earnings Momentum Continuation",
    description: "Catalyst-driven continuation with volume and momentum stacked ahead of a multi-day expansion.",
    learningGoal: "Learn when momentum deserves follow-through and when a catalyst move is already exhausted.",
    whenNotToUse: "Avoid when volume fades after the catalyst or when the move is far from any clean risk point.",
    sizingNotes: "Use strict stop placement and only escalate to MAX when the post-catalyst base stays constructive.",
    walkthrough: "Start with the catalyst, then require momentum, relative strength, and clean structure before sizing the trade.",
    invalidationStyle: "Lose post-earnings base support or fail the breakout retest immediately.",
    setupTypes: ["Breakout", "Gap and Go"],
    conditions: ["Catalyst", "Volume Expansion", "Relative Strength"],
    chartPattern: "Ascending Triangle",
    metricIds: ["f_eps", "f_rev", "f_cat", "t_mom", "t_vol", "t_vwap", "t_ema", "t_macdh"],
  },
  {
    key: "value-investment-core",
    mode: "investment",
    name: "Value Investment Core",
    description: "Longer-duration valuation and quality strategy built for durable asymmetry rather than short-term noise.",
    learningGoal: "Train patience and improve thesis discipline around valuation, cash flow, and business durability.",
    whenNotToUse: "Avoid if the thesis depends on immediate momentum or if the business quality is still structurally deteriorating.",
    sizingNotes: "Prefer STD and HIGH sizing, with wider stops and longer time horizons than shorter-term operating modes.",
    walkthrough: "Build the trade around valuation, durability, and moat, then use technical trend context only as timing support.",
    invalidationStyle: "Fundamental thesis breaks, valuation closes the gap, or price loses the long-term trend floor.",
    setupTypes: ["Accumulation", "Base"],
    conditions: ["Valuation Support", "Quality Confirmation"],
    chartPattern: "Base",
    metricIds: ["f_pe", "f_peg", "f_eveb", "f_fcfy", "f_roe", "f_moat", "f_val", "t_trend200"],
  },
  {
    key: "intraday-vwap-trend",
    mode: "daytrade",
    name: "Intraday VWAP Trend",
    description: "Execution-first intraday trend strategy built around VWAP control, ribbon alignment, and clean risk.",
    learningGoal: "Develop discipline around intraday alignment instead of forcing every fast mover.",
    whenNotToUse: "Avoid in dead midday tape, illiquid names, or when price cannot hold either VWAP or the key intraday EMA stack.",
    sizingNotes: "Keep stops tight and scale only when the move reclaims VWAP with expanding participation.",
    walkthrough: "Score only when VWAP, EMA structure, and momentum all confirm the same directional path.",
    invalidationStyle: "Lose VWAP and fail to reclaim it on the next rotation.",
    setupTypes: ["Trend Continuation", "VWAP Reclaim"],
    conditions: ["VWAP Hold", "Intraday Momentum", "Volume Confirmation"],
    chartPattern: "Channel",
    metricIds: ["t_vwap", "t_ema", "t_mom", "t_vol", "t_bb", "t_rsi5"],
  },
  {
    key: "mean-reversion-reclaim",
    mode: "daytrade",
    name: "Mean Reversion Reclaim",
    description: "A tactical reclaim setup for stretched names reverting back through a key intraday reference.",
    learningGoal: "Learn the difference between a real reclaim and a weak bounce that never regains control.",
    whenNotToUse: "Avoid in trend days that never actually stabilize or when the reclaim level has already failed multiple times.",
    sizingNotes: "Treat this as a faster rotation strategy and keep both stops and profit-taking disciplined.",
    walkthrough: "Wait for a reclaim, then require momentum stabilization and improving breadth before taking the trade.",
    invalidationStyle: "Lose the reclaim level and fail to hold the reversal pivot.",
    setupTypes: ["Reversal", "Reclaim"],
    conditions: ["Oversold", "VWAP Reclaim", "Improving Momentum"],
    chartPattern: "W Bottom",
    metricIds: ["f_cat", "t_vwap", "t_stoch", "t_rsi5", "t_bb", "t_vol"],
  },
  {
    key: "quick-scalp-core",
    mode: "scalp",
    name: "Quick Scalp Core",
    description: "Micro-structure focused scalp template for fast rotations with almost no tolerance for hesitation.",
    learningGoal: "Build speed discipline without abandoning structured entry, stop, and momentum rules.",
    whenNotToUse: "Avoid if the tape is choppy, spreads are wide, or you cannot execute near the planned level.",
    sizingNotes: "Keep risk tight, take partials early, and do not widen the stop to rescue a failed scalp.",
    walkthrough: "Require immediate structure, directional flow, and tape alignment. If one drops out, the trade is wrong.",
    invalidationStyle: "Immediate loss of tape momentum or reclaim failure after entry.",
    setupTypes: ["Momentum Burst", "Tape Reclaim"],
    conditions: ["VWAP Alignment", "Momentum Expansion"],
    chartPattern: "Micro Flag",
    metricIds: ["t_ema5", "t_vwap", "t_stoch", "t_bb", "t_vol", "t_rsi5"],
  },
];

export function getStrategyPresetsForMode(mode: TradeMode): StrategyPresetDefinition[] {
  return STRATEGY_PRESETS.filter((preset) => preset.mode === mode);
}

export function buildStarterStructure(mode: TradeMode): StrategyStructureSnapshot {
  const starterPreset = getStarterStrategyPreset(mode);

  return {
    setupTypes: [...starterPreset.setupTypes],
    conditions: [...starterPreset.conditions],
    chartPattern: starterPreset.chartPattern,
    sizingNotes: starterPreset.sizingNotes,
    invalidationStyle: starterPreset.invalidationStyle,
  };
}

export function getStarterStrategyPreset(mode: TradeMode): StrategyPresetDefinition {
  const preset = getStrategyPresetsForMode(mode)[0];
  if (preset) {
    return preset;
  }

  const metricIds = buildMetricsForMode(mode).map((metric) => metric.id);
  return {
    key: `core-${mode}`,
    mode,
    name: `${formatModeLabel(mode)} Core Strategy`,
    description: `Starter ${formatModeLabel(mode).toLowerCase()} strategy seeded from the default mode stack.`,
    learningGoal: `Start with a complete ${formatModeLabel(mode).toLowerCase()} checklist, then refine it into a named edge.`,
    whenNotToUse: "Avoid treating the starter stack as a final edge. It is a learning baseline, not a fixed answer.",
    sizingNotes: "Begin with conservative sizing until the strategy has enough sample size to justify stronger conviction.",
    walkthrough: "Use the starter stack as a draft, then remove weak checks and add your own language as you learn what matters.",
    invalidationStyle: "Exit when the reason for the setup is clearly broken.",
    setupTypes: [`${formatModeLabel(mode)} general strategy`],
    conditions: [],
    chartPattern: "None",
    metricIds,
  };
}

export function buildMetricsFromPreset(preset: StrategyPresetDefinition): Metric[] {
  return preset.metricIds.flatMap((metricId) => {
    const metric = getMetricDefinition(metricId);
    return metric ? [{ ...metric, enabled: true }] : [];
  });
}

export function buildStarterStrategyBlueprint(mode: TradeMode): {
  name: string;
  description: string;
  learningGoal: string;
  presetKey: string;
  structure: StrategyStructureSnapshot;
  metrics: Metric[];
} {
  const preset = getStarterStrategyPreset(mode);

  return {
    name: `${formatModeLabel(mode)} Core Strategy`,
    description: preset.description,
    learningGoal: preset.learningGoal,
    presetKey: preset.key,
    structure: buildStarterStructure(mode),
    metrics: buildMetricsForMode(mode).map((metric) => ({ ...metric, enabled: true })),
  };
}