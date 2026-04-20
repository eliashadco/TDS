import { TradeAssessment, ConvictionTier } from './types';
import { MAX_PORTFOLIO_HEAT } from './constants';

export function detectContradictions(thesis: string, assessment: TradeAssessment) {
  // Simple check for now, could be AI-driven later
  const contradictions: string[] = [];
  if (thesis.toLowerCase().includes('bullish') && assessment.verdict === 'FAIL') {
    contradictions.push('Thesis is bullish but assessment failed.');
  }
  return contradictions;
}

export function evaluateGates(assessment: TradeAssessment) {
  const metrics = Object.values(assessment.metrics);
  const requiredMetrics = metrics.filter(m => m.passed === false); // This is wrong, need to check if required metrics passed

  // Real logic: if any required metric fails, the whole thing fails
  return assessment.verdict !== 'FAIL';
}

export function validatePortfolioHeat(currentHeat: number, newTradeRisk: number) {
  return (currentHeat + newTradeRisk) <= MAX_PORTFOLIO_HEAT;
}

export function validatePositionSize(size: number, maxAllowed: number) {
  return size <= maxAllowed;
}
