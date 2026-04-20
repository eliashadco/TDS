import { Strategy, Direction, Metric } from './types';
import { getDirectionDescription } from './direction';

export function buildAssessmentPrompt(symbol: string, direction: Direction, thesis: string, catalyst: string, invalidation: string, strategy: Strategy) {
  const metricsList = strategy.metrics.map(m => `- ${m.name}: ${getDirectionDescription(m, direction)} (${m.description})`).join('\n');

  return `
    Trade Symbol: ${symbol}
    Direction: ${direction}
    Trading Mode: ${strategy.mode}
    
    Thesis:
    ${thesis}
    
    Catalyst Window:
    ${catalyst}
    
    Invalidation Condition:
    ${invalidation}
    
    Strategy Metrics:
    ${metricsList}
    
    Additional Instructions:
    ${strategy.aiInstructions}
    
    Task:
    Evaluate the thesis against each metric. For each metric, provide:
    1. Passed (true/false)
    2. Score (0-100)
    3. Reasoning (brief explanation)
    
    Also, specifically evaluate the following Mechanical Gates:
    
    Fundamental Gate (F1-F5):
    - F1: Earnings trajectory (Beats/Acceleration)
    - F2: Institutional positioning (Net buying)
    - F3: Sector/macro tailwind (Specific driver)
    - F4: Valuation asymmetry (Not top-quartile expensive)
    - F5: Balance sheet health (No distress)
    
    Technical Gate (T1-T3):
    - T1: Trend structure (Price > 20 EMA > 50 EMA for Long)
    - T2: Momentum confirmation (RSI 50-70, MACD positive)
    - T3: Volume confirmation (Expanding on move)
    
    Return:
    - metrics: results for strategy metrics
    - fundamentalScore: number of F-criteria passed (0-5)
    - technicalScore: number of T-criteria passed (0-3)
    - verdict: PASS (if F >= 3 and T == 3), FAIL (if T < 3 or F < 3), or CAUTION (if F >= 4 but T < 3 - Watchlist only)
    - summary: overall assessment
    - edge: what is the primary advantage?
    - risks: what could go wrong?
    
    Return the response in JSON format.
  `;
}
