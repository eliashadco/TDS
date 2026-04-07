import type { Metric, TradeMode } from "@/types/trade";

export type TradePresetOption = {
  label: string;
  family: string;
  detail: string;
  keywords: string[];
};

const FUNDAMENTAL_METRICS: Metric[] = [
  { id: "f_pe", name: "P/E Ratio", description: "Price-to-earnings vs sector", category: "val", type: "fundamental", enabled: true },
  { id: "f_peg", name: "PEG", description: "P/E relative to growth", category: "val", type: "fundamental", enabled: true },
  { id: "f_pb", name: "P/B Ratio", description: "Market vs book value", category: "val", type: "fundamental", enabled: true },
  { id: "f_eveb", name: "EV/EBITDA", description: "Capital-neutral valuation", category: "val", type: "fundamental", enabled: true },
  { id: "f_fcfy", name: "FCF Yield", description: "FCF relative to market cap", category: "val", type: "fundamental", enabled: true },
  { id: "f_roe", name: "ROE", description: "Return on equity >=15%", category: "quality", type: "fundamental", enabled: true },
  { id: "f_roce", name: "ROCE", description: "Return on all capital", category: "quality", type: "fundamental", enabled: true },
  { id: "f_margin", name: "Op. Margin", description: "Operating efficiency ratio", category: "quality", type: "fundamental", enabled: true },
  { id: "f_fcf", name: "Free Cash Flow", description: "Positive and growing FCF", category: "quality", type: "fundamental", enabled: true },
  { id: "f_div", name: "Dividend", description: "Sustainable payout, growing", category: "quality", type: "fundamental", enabled: true },
  { id: "f_moat", name: "Moat", description: "Competitive advantages", category: "quality", type: "fundamental", enabled: true },
  { id: "f_eps", name: "EPS", description: "Earnings trajectory", category: "mom", type: "fundamental", enabled: true },
  { id: "f_rev", name: "Revenue", description: "Top-line trajectory", category: "mom", type: "fundamental", enabled: true },
  { id: "f_est", name: "Analyst Rev.", description: "Estimate revision direction", category: "mom", type: "fundamental", enabled: true },
  { id: "f_ins", name: "Insider", description: "Form 4 buying/selling", category: "mom", type: "fundamental", enabled: true },
  { id: "f_inst", name: "Inst. Flow", description: "13F accumulation/distribution", category: "mom", type: "fundamental", enabled: true },
  { id: "f_debt", name: "Balance Sheet", description: "Leverage, coverage, FCF", category: "risk", type: "fundamental", enabled: true },
  { id: "f_si", name: "Short Interest", description: "SI% of float", category: "risk", type: "fundamental", enabled: true },
  { id: "f_beta", name: "Beta", description: "Volatility vs market", category: "risk", type: "fundamental", enabled: true },
  { id: "f_macro", name: "Macro", description: "Policy/cyclical forces", category: "macro", type: "fundamental", enabled: true },
  { id: "f_cat", name: "Catalyst", description: "Upcoming event driver", category: "macro", type: "fundamental", enabled: true },
  { id: "f_float", name: "Float", description: "Share structure analysis", category: "macro", type: "fundamental", enabled: true },
  { id: "f_val", name: "Valuation Asym.", description: "Mispricing vs intrinsic", category: "val", type: "fundamental", enabled: true },
];

const TECHNICAL_METRICS: Metric[] = [
  { id: "t_trend", name: "EMA 20/50", description: "Weekly EMA alignment", category: "trend", type: "technical", enabled: true },
  { id: "t_trend200", name: "200 DMA", description: "Long-term trend", category: "trend", type: "technical", enabled: true },
  { id: "t_mom", name: "RSI/MACD", description: "Momentum confirmation", category: "mom", type: "technical", enabled: true },
  { id: "t_vol", name: "Volume", description: "Volume directional", category: "vol", type: "technical", enabled: true },
  { id: "t_rs", name: "Rel. Strength", description: "vs benchmark", category: "trend", type: "technical", enabled: true },
  { id: "t_vix", name: "Volatility", description: "BB/ATR regime", category: "vol", type: "technical", enabled: true },
  { id: "t_vwap", name: "VWAP", description: "Volume-weighted avg price", category: "intra", type: "technical", enabled: true },
  { id: "t_ema", name: "EMA 9/20", description: "5-min alignment", category: "intra", type: "technical", enabled: true },
  { id: "t_rsi", name: "RSI(7)", description: "Short momentum", category: "mom", type: "technical", enabled: true },
  { id: "t_atr", name: "ATR Range", description: "Sufficient range for profit", category: "vol", type: "technical", enabled: true },
  { id: "t_level", name: "S/R Levels", description: "Key structure levels", category: "struct", type: "technical", enabled: true },
  { id: "t_ema5", name: "EMA Ribbon", description: "5/8/13 on 1-min", category: "intra", type: "technical", enabled: true },
  { id: "t_stoch", name: "Stochastic", description: "5-3-3 scalp signal", category: "mom", type: "technical", enabled: true },
  { id: "t_bb", name: "Bollinger", description: "Squeeze/reversal", category: "vol", type: "technical", enabled: true },
  { id: "t_rsi5", name: "RSI(5)", description: "Micro momentum", category: "mom", type: "technical", enabled: true },
  { id: "t_obv", name: "OBV", description: "Cumulative volume flow", category: "vol", type: "technical", enabled: true },
  { id: "t_adx", name: "ADX", description: "Trend strength >25", category: "trend", type: "technical", enabled: true },
  { id: "t_psar", name: "Parabolic SAR", description: "Trail/reversal dots", category: "trend", type: "technical", enabled: true },
  { id: "t_fib", name: "Fibonacci", description: "Retracement levels", category: "struct", type: "technical", enabled: true },
  { id: "t_macdh", name: "MACD Hist", description: "Histogram momentum", category: "mom", type: "technical", enabled: true },
];

export const METRIC_LIBRARY = {
  fundamental: FUNDAMENTAL_METRICS,
  technical: TECHNICAL_METRICS,
} as const;

export const MODE_PRESETS: Record<TradeMode, { f: string[]; t: string[] }> = {
  investment: {
    f: ["f_eps", "f_rev", "f_roe", "f_fcf", "f_debt", "f_moat", "f_val", "f_ins", "f_est", "f_inst", "f_macro"],
    t: ["t_trend200", "t_rs", "t_vol"],
  },
  swing: {
    f: ["f_eps", "f_inst", "f_macro", "f_val", "f_debt", "f_ins", "f_est"],
    t: ["t_trend", "t_mom", "t_vol", "t_rs", "t_vix"],
  },
  daytrade: {
    f: ["f_cat", "f_float"],
    t: ["t_vwap", "t_ema", "t_rsi", "t_vol", "t_atr", "t_level"],
  },
  scalp: {
    f: [],
    t: ["t_ema5", "t_vwap", "t_stoch", "t_bb", "t_vol", "t_rsi5"],
  },
};

export const SETUP_TYPE_OPTIONS: TradePresetOption[] = [
  {
    label: "Breakout",
    family: "Expansion",
    detail: "Price clears well-defined resistance and starts trend expansion.",
    keywords: ["resistance", "range high", "expansion", "momentum"],
  },
  {
    label: "Breakdown",
    family: "Expansion",
    detail: "Price loses support and opens a fresh downside leg.",
    keywords: ["support", "failure", "selloff", "downtrend"],
  },
  {
    label: "Continuation",
    family: "Trend",
    detail: "Existing trend pauses, resets, and then resumes.",
    keywords: ["trend", "pause", "resume", "pullback"],
  },
  {
    label: "Reversal",
    family: "Reversal",
    detail: "Exhaustion plus structure shift suggests a directional turn.",
    keywords: ["turn", "exhaustion", "reclaim", "flush"],
  },
  {
    label: "Mean Reversion",
    family: "Reversal",
    detail: "Price is stretched from fair value and may snap back toward the mean.",
    keywords: ["stretch", "snapback", "extreme", "fade"],
  },
  {
    label: "Pullback",
    family: "Trend",
    detail: "Controlled retrace into a support or resistance decision zone.",
    keywords: ["retracement", "trend entry", "support", "resistance"],
  },
  {
    label: "Trend Resumption",
    family: "Trend",
    detail: "A mature trend regains momentum after a shallow reset.",
    keywords: ["trend", "resume", "higher low", "lower high"],
  },
  {
    label: "Base Break",
    family: "Expansion",
    detail: "A long base or compression resolves into a directional move.",
    keywords: ["base", "compression", "launchpad", "range"],
  },
  {
    label: "Failed Breakdown",
    family: "Reversal",
    detail: "Sellers lose follow-through after support breaks and snaps back.",
    keywords: ["trap", "reclaim", "bear trap", "failure"],
  },
  {
    label: "Failed Breakout",
    family: "Reversal",
    detail: "Buyers fail to hold a breakout, opening the door to a fade.",
    keywords: ["trap", "reject", "bull trap", "failure"],
  },
  {
    label: "Gap and Go",
    family: "Catalyst",
    detail: "A catalyst gap holds and continues in the gap direction.",
    keywords: ["gap", "open drive", "news", "momentum"],
  },
  {
    label: "Gap Fill Fade",
    family: "Catalyst",
    detail: "A gap exhausts and rotates back toward the prior close.",
    keywords: ["gap fill", "fade", "retrace", "open"],
  },
  {
    label: "Earnings Momentum",
    family: "Catalyst",
    detail: "Post-earnings repricing creates multi-session directional flow.",
    keywords: ["earnings", "guidance", "reprice", "event"],
  },
  {
    label: "Post-Earnings Drift",
    family: "Catalyst",
    detail: "The first post-earnings push continues after the initial reaction.",
    keywords: ["earnings", "drift", "follow-through", "day two"],
  },
  {
    label: "News Catalyst",
    family: "Catalyst",
    detail: "Fresh narrative change creates a tradeable repricing window.",
    keywords: ["news", "headline", "catalyst", "event"],
  },
  {
    label: "Relative Strength Leader",
    family: "Leadership",
    detail: "A name leads its sector and keeps outperforming into strength.",
    keywords: ["leader", "sector", "relative strength", "outperform"],
  },
  {
    label: "Relative Weakness Laggard",
    family: "Leadership",
    detail: "A name lags its peer group and stays weak into rallies.",
    keywords: ["laggard", "sector", "relative weakness", "underperform"],
  },
  {
    label: "IPO Expansion",
    family: "Catalyst",
    detail: "A recent IPO clears discovery levels and expands range rapidly.",
    keywords: ["ipo", "price discovery", "new issue", "expansion"],
  },
];

export const CONDITION_OPTIONS: TradePresetOption[] = [
  {
    label: "At Support",
    family: "Structure",
    detail: "Price is reacting near a proven demand zone.",
    keywords: ["support", "demand", "floor"],
  },
  {
    label: "At Resistance",
    family: "Structure",
    detail: "Price is testing a proven supply zone.",
    keywords: ["resistance", "supply", "ceiling"],
  },
  {
    label: "Higher Low",
    family: "Structure",
    detail: "Buyers keep defending progressively stronger swing lows.",
    keywords: ["higher low", "trend support", "structure"],
  },
  {
    label: "Lower High",
    family: "Structure",
    detail: "Rallies keep failing below the prior swing high.",
    keywords: ["lower high", "trend resistance", "structure"],
  },
  {
    label: "Inside Day",
    family: "Compression",
    detail: "Range contracts inside the prior session and can precede expansion.",
    keywords: ["inside day", "coil", "compression"],
  },
  {
    label: "Multi-Day Base",
    family: "Compression",
    detail: "Price is holding a tight shelf after prior volatility.",
    keywords: ["base", "consolidation", "tight range"],
  },
  {
    label: "Overbought",
    family: "Momentum",
    detail: "Momentum is extended and vulnerable to a stall or fade.",
    keywords: ["extended", "stretched", "hot"],
  },
  {
    label: "Oversold",
    family: "Momentum",
    detail: "Momentum is washed out and vulnerable to a reflex move.",
    keywords: ["washed out", "stretched", "panic"],
  },
  {
    label: "Momentum Divergence",
    family: "Momentum",
    detail: "Price and momentum are no longer confirming one another.",
    keywords: ["divergence", "RSI", "MACD"],
  },
  {
    label: "VWAP Reclaim",
    family: "Momentum",
    detail: "Price loses then retakes VWAP, suggesting intraday control shift.",
    keywords: ["vwap", "reclaim", "intraday"],
  },
  {
    label: "VWAP Rejection",
    family: "Momentum",
    detail: "Price rejects at VWAP and confirms intraday weakness.",
    keywords: ["vwap", "rejection", "intraday"],
  },
  {
    label: "Squeeze",
    family: "Compression",
    detail: "Volatility compression sets up a larger move once released.",
    keywords: ["compression", "bollinger", "atr"],
  },
  {
    label: "ATR Expansion",
    family: "Liquidity",
    detail: "True range is expanding enough to support active execution.",
    keywords: ["atr", "range", "volatility"],
  },
  {
    label: "High Relative Volume",
    family: "Liquidity",
    detail: "Participation is elevated versus the recent baseline.",
    keywords: ["volume", "liquidity", "participation"],
  },
  {
    label: "Low Float Pressure",
    family: "Liquidity",
    detail: "Low float dynamics can exaggerate one-sided moves.",
    keywords: ["low float", "squeeze", "liquidity"],
  },
  {
    label: "Gap Up",
    family: "Catalyst",
    detail: "Price is opening above the prior range after a catalyst.",
    keywords: ["gap", "open", "upside"],
  },
  {
    label: "Gap Down",
    family: "Catalyst",
    detail: "Price is opening below the prior range after a catalyst.",
    keywords: ["gap", "open", "downside"],
  },
  {
    label: "Trend Day",
    family: "Session Flow",
    detail: "The session is holding directional pressure with little reversal.",
    keywords: ["trend day", "session", "momentum"],
  },
  {
    label: "Range Day",
    family: "Session Flow",
    detail: "The session is rotating between established intraday levels.",
    keywords: ["range", "rotation", "session"],
  },
  {
    label: "Opening Range Hold",
    family: "Session Flow",
    detail: "The opening move is holding instead of reversing.",
    keywords: ["opening range", "hold", "session"],
  },
  {
    label: "Opening Range Failure",
    family: "Session Flow",
    detail: "The opening move is failing and reversing back through range.",
    keywords: ["opening range", "failure", "session"],
  },
  {
    label: "Near 52-Week High",
    family: "Context",
    detail: "Price is trading near leadership highs where expansion can continue.",
    keywords: ["52 week high", "leadership", "breakout"],
  },
  {
    label: "Near 52-Week Low",
    family: "Context",
    detail: "Price is trading near extreme weakness where breakdown or reversal can trigger.",
    keywords: ["52 week low", "weakness", "breakdown"],
  },
  {
    label: "Sector Rotation",
    family: "Context",
    detail: "Sector flow is reinforcing the individual name setup.",
    keywords: ["sector", "rotation", "relative strength"],
  },
  {
    label: "Post-Earnings Repricing",
    family: "Context",
    detail: "A recent event reset expectations and broadened price discovery.",
    keywords: ["earnings", "event", "repricing"],
  },
];

export const CHART_PATTERN_OPTIONS: TradePresetOption[] = [
  {
    label: "None",
    family: "General",
    detail: "Use this when the trade is thesis-led without a dominant chart pattern.",
    keywords: ["general", "no pattern"],
  },
  {
    label: "Ascending Triangle",
    family: "Continuation",
    detail: "Higher lows press into flat resistance.",
    keywords: ["triangle", "higher lows", "breakout"],
  },
  {
    label: "Descending Triangle",
    family: "Continuation",
    detail: "Lower highs press into flat support.",
    keywords: ["triangle", "lower highs", "breakdown"],
  },
  {
    label: "Symmetrical Triangle",
    family: "Compression",
    detail: "Price contracts between converging trend lines.",
    keywords: ["triangle", "coil", "compression"],
  },
  {
    label: "Bull Flag",
    family: "Continuation",
    detail: "A strong impulse leg pauses in a tight downward drift.",
    keywords: ["flag", "continuation", "bullish"],
  },
  {
    label: "Bear Flag",
    family: "Continuation",
    detail: "A strong downside impulse pauses in a tight upward drift.",
    keywords: ["flag", "continuation", "bearish"],
  },
  {
    label: "Pennant",
    family: "Continuation",
    detail: "Sharp move compresses into a small triangle before the next leg.",
    keywords: ["pennant", "continuation", "compression"],
  },
  {
    label: "Cup and Handle",
    family: "Base",
    detail: "Rounded recovery followed by a tight handle consolidation.",
    keywords: ["cup", "handle", "base"],
  },
  {
    label: "Flat Base",
    family: "Base",
    detail: "Tight multi-week shelf forms near highs before expansion.",
    keywords: ["flat base", "shelf", "tight"],
  },
  {
    label: "Rectangle",
    family: "Base",
    detail: "Price oscillates between flat support and resistance boundaries.",
    keywords: ["rectangle", "range", "box"],
  },
  {
    label: "Rounded Base",
    family: "Base",
    detail: "A gradual bottoming structure forms before trend improvement.",
    keywords: ["rounded", "saucer", "base"],
  },
  {
    label: "Head and Shoulders",
    family: "Reversal",
    detail: "A topping structure with a neckline breakdown trigger.",
    keywords: ["head and shoulders", "top", "reversal"],
  },
  {
    label: "Inverse Head and Shoulders",
    family: "Reversal",
    detail: "A bottoming structure with a neckline breakout trigger.",
    keywords: ["inverse", "bottom", "reversal"],
  },
  {
    label: "Double Top",
    family: "Reversal",
    detail: "Repeated failure near highs signals weakening demand.",
    keywords: ["double top", "resistance", "reversal"],
  },
  {
    label: "Double Bottom",
    family: "Reversal",
    detail: "Repeated defense near lows signals improving demand.",
    keywords: ["double bottom", "support", "reversal"],
  },
  {
    label: "Rising Wedge",
    family: "Reversal",
    detail: "An upward-sloping squeeze that can fail lower.",
    keywords: ["wedge", "rising wedge", "reversal"],
  },
  {
    label: "Falling Wedge",
    family: "Reversal",
    detail: "A downward-sloping squeeze that can resolve higher.",
    keywords: ["wedge", "falling wedge", "reversal"],
  },
  {
    label: "Channel",
    family: "General",
    detail: "Price respects parallel support and resistance rails.",
    keywords: ["channel", "trend", "parallel"],
  },
  {
    label: "Volatility Contraction Pattern",
    family: "Compression",
    detail: "Successively tighter pullbacks hint at coiled institutional demand.",
    keywords: ["vcp", "contraction", "compression"],
  },
];

export const SETUP_TYPES = SETUP_TYPE_OPTIONS.map((item) => item.label);

export const CONDITIONS = CONDITION_OPTIONS.map((item) => item.label);

export const CHART_PATTERNS = CHART_PATTERN_OPTIONS.map((item) => item.label);

const METRIC_LOOKUP: Record<string, Metric> = [...FUNDAMENTAL_METRICS, ...TECHNICAL_METRICS].reduce(
  (acc, metric) => {
    acc[metric.id] = metric;
    return acc;
  },
  {} as Record<string, Metric>,
);

export function getMetricDefinition(metricId: string): Metric | null {
  return METRIC_LOOKUP[metricId] ?? null;
}

export function buildMetricsForMode(mode: TradeMode): Metric[] {
  const preset = MODE_PRESETS[mode];
  const ids = [...preset.f, ...preset.t];

  return ids
    .map((id) => METRIC_LOOKUP[id])
    .filter((metric): metric is Metric => Boolean(metric))
    .map((metric) => ({ ...metric, enabled: true }));
}