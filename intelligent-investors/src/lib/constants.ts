import { TradingMode, ConvictionTier } from './types';

export const TRADING_MODES: { value: TradingMode; label: string; description: string }[] = [
  {
    value: 'investment',
    label: 'Investment',
    description: 'Long-term wealth building, fundamental focus, months to years.',
  },
  {
    value: 'swing',
    label: 'Swing',
    description: 'Capturing multi-day moves, technical & fundamental mix, days to weeks.',
  },
  {
    value: 'daytrade',
    label: 'Day Trade',
    description: 'Intraday momentum, technical focus, minutes to hours.',
  },
  {
    value: 'scalp',
    label: 'Scalp',
    description: 'High-frequency precision, micro-moves, seconds to minutes.',
  },
];

export const CONVICTION_TIERS: { value: ConvictionTier; label: string; multiplier: number }[] = [
  { value: 'NONE', label: 'No Conviction', multiplier: 0 },
  { value: 'STANDARD', label: 'Standard', multiplier: 1.0 }, // 2% risk
  { value: 'HIGH', label: 'High', multiplier: 1.5 },         // 3% risk
  { value: 'MAXIMUM', label: 'Maximum', multiplier: 2.0 },   // 4% risk
];

export const MAX_PORTFOLIO_HEAT = 0.12; // 12% total risk at any time
export const DEFAULT_RISK_PER_TRADE = 0.01; // 1% default risk

export const SETUP_TYPES = [
  "Breakout", "Retest", "Mean Reversion", "Trend Following", 
  "Reversal", "Gap & Go", "Exhaustion", "News/Catalyst", 
  "Earnings Play", "Relative Strength"
];

export const SETUP_CONDITIONS = [
  "High Volume", "Low Volatility", "Overextended", "Consolidation",
  "Sector Strength", "Market Alignment", "Support/Resistance", "Divergence"
];

export const CHART_PATTERNS = [
  "Bull Flag", "Bear Flag", "Cup & Handle", "Head & Shoulders",
  "Double Top", "Double Bottom", "Ascending Triangle", "Descending Triangle",
  "Symmetrical Triangle", "Falling Wedge", "Rising Wedge", "Channel"
];
