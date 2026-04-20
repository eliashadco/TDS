import { TradingMode, Strategy, Metric } from './types';

export const DEFAULT_METRICS: { [key in TradingMode]: Metric[] } = {
  investment: [
    { id: 'm1', name: 'Revenue Growth', category: 'Fundamental', description: 'Consistent YoY growth', longInterpretation: 'Growth > 15%', shortInterpretation: 'Growth < 0%', weight: 1, isRequired: true },
    { id: 'm2', name: 'Moat', category: 'Fundamental', description: 'Competitive advantage', longInterpretation: 'Strong moat', shortInterpretation: 'No moat', weight: 1, isRequired: true },
  ],
  swing: [
    { id: 'm3', name: 'Trend Alignment', category: 'Technical', description: 'Price above 50SMA', longInterpretation: 'Price > 50SMA', shortInterpretation: 'Price < 50SMA', weight: 1, isRequired: true },
    { id: 'm4', name: 'RSI Divergence', category: 'Technical', description: 'Momentum shift', longInterpretation: 'Bullish divergence', shortInterpretation: 'Bearish divergence', weight: 1, isRequired: false },
  ],
  daytrade: [
    { id: 'm5', name: 'Volume Spike', category: 'Technical', description: 'Relative volume > 2', longInterpretation: 'High relative volume', shortInterpretation: 'High relative volume', weight: 1, isRequired: true },
    { id: 'm6', name: 'VWAP Alignment', category: 'Technical', description: 'Price relative to VWAP', longInterpretation: 'Price > VWAP', shortInterpretation: 'Price < VWAP', weight: 1, isRequired: true },
  ],
  scalp: [
    { id: 'm7', name: 'Level 2 Depth', category: 'Technical', description: 'Bid/Ask imbalance', longInterpretation: 'Bid depth > Ask depth', shortInterpretation: 'Ask depth > Bid depth', weight: 1, isRequired: true },
    { id: 'm8', name: 'Spread', category: 'Technical', description: 'Tight spread', longInterpretation: 'Spread < 0.05%', shortInterpretation: 'Spread < 0.05%', weight: 1, isRequired: true },
  ],
};

export function buildBlankStrategyPreset(mode: TradingMode): Partial<Strategy> {
  return {
    name: `New ${mode.charAt(0).toUpperCase() + mode.slice(1)} Strategy`,
    mode,
    version: 1,
    metrics: DEFAULT_METRICS[mode],
    aiInstructions: `You are an expert ${mode} trader. Evaluate the following thesis against the metrics provided.`,
    isDefault: true,
  };
}
