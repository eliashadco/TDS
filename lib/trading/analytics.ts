import type { Trade } from "@/types/trade";

export interface Analytics {
  winRate: number;
  avgWinR: number;
  avgLossR: number;
  expectancy: number;
  totalR: number;
  profitFactor: number;
  rollingExpectancy: number;
  tradeCount: number;
}

export interface RealizedAnalytics extends Analytics {
  capturedTradeCount: number;
  totalPnl: number;
  avgPnl: number;
}

type OutcomeKind = "modeled" | "realized";

type RealizedOutcome = {
  rMultiple: number;
  pnl: number;
};

function resolveExitState(trade: Trade): { t1: boolean; t2: boolean; t3: boolean } {
  return {
    t1: Boolean(trade.exit_t1),
    t2: Boolean(trade.exit_t2),
    t3: Boolean(trade.exit_t3),
  };
}

export function estimateModeledRMultiple(trade: Trade): number {
  const exits = resolveExitState(trade);

  if (exits.t1 && exits.t2 && exits.t3) {
    return 2.75;
  }
  if (exits.t1 && exits.t2) {
    return 1;
  }
  if (exits.t1) {
    return -0.25;
  }
  return -1;
}

function asFiniteNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

export function resolveRealizedOutcome(trade: Trade): RealizedOutcome | null {
  const entryPrice = asFiniteNumber(trade.entry_price);
  const stopLoss = asFiniteNumber(trade.stop_loss);
  const exitPrice = asFiniteNumber(trade.exit_price);
  const shares = asFiniteNumber(trade.shares);

  if (entryPrice == null || stopLoss == null || exitPrice == null || shares == null || shares <= 0) {
    return null;
  }

  const riskPerShare = Math.abs(entryPrice - stopLoss);
  if (riskPerShare <= 0) {
    return null;
  }

  const pnl = trade.direction === "LONG"
    ? (exitPrice - entryPrice) * shares
    : (entryPrice - exitPrice) * shares;

  return {
    rMultiple: pnl / (riskPerShare * shares),
    pnl,
  };
}

function computeExpectancy(rValues: number[]): number {
  if (rValues.length === 0) {
    return 0;
  }

  const wins = rValues.filter((r) => r > 0);
  const losses = rValues.filter((r) => r <= 0);
  const winRate = wins.length / rValues.length;
  const avgWinR = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLossR = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

  return (winRate * avgWinR) + ((1 - winRate) * avgLossR);
}

function buildAnalyticsFromRValues(rValues: number[], tradeCount: number): Analytics {
  if (tradeCount === 0 || rValues.length === 0) {
    return {
      winRate: 0,
      avgWinR: 0,
      avgLossR: 0,
      expectancy: 0,
      totalR: 0,
      profitFactor: 0,
      rollingExpectancy: 0,
      tradeCount,
    };
  }

  const wins = rValues.filter((r) => r > 0);
  const losses = rValues.filter((r) => r <= 0);

  const totalR = rValues.reduce((a, b) => a + b, 0);
  const winRate = wins.length / rValues.length;
  const avgWinR = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLossR = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const expectancy = (winRate * avgWinR) + ((1 - winRate) * avgLossR);

  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = losses.reduce((a, b) => a + b, 0);
  const profitFactor = grossLoss < 0 ? Math.min(grossProfit / Math.abs(grossLoss), 99.99) : grossProfit > 0 ? 99.99 : 0;

  const rollingValues = rValues.slice(-20);
  const rollingExpectancy = computeExpectancy(rollingValues);

  return {
    winRate,
    avgWinR,
    avgLossR,
    expectancy,
    totalR,
    profitFactor,
    rollingExpectancy,
    tradeCount,
  };
}

export function calculateAnalytics(closedTrades: Trade[]): Analytics {
  const rValues = closedTrades.map(estimateModeledRMultiple);
  return buildAnalyticsFromRValues(rValues, closedTrades.length);
}

export function calculateRealizedAnalytics(closedTrades: Trade[]): RealizedAnalytics {
  const outcomes = closedTrades.map(resolveRealizedOutcome).filter((outcome): outcome is RealizedOutcome => Boolean(outcome));
  const rValues = outcomes.map((outcome) => outcome.rMultiple);
  const analytics = buildAnalyticsFromRValues(rValues, closedTrades.length);
  const totalPnl = outcomes.reduce((sum, outcome) => sum + outcome.pnl, 0);

  return {
    ...analytics,
    capturedTradeCount: outcomes.length,
    totalPnl,
    avgPnl: outcomes.length > 0 ? totalPnl / outcomes.length : 0,
  };
}

export function analyticsBySource(trades: Trade[]): { thesis: Analytics; marketwatch: Analytics } {
  const thesis = trades.filter((trade) => (trade.source ?? "thesis") === "thesis");
  const marketwatch = trades.filter((trade) => trade.source === "marketwatch");

  return {
    thesis: calculateAnalytics(thesis),
    marketwatch: calculateAnalytics(marketwatch),
  };
}

export function analyticsBySourceRealized(trades: Trade[]): { thesis: RealizedAnalytics; marketwatch: RealizedAnalytics } {
  const thesis = trades.filter((trade) => (trade.source ?? "thesis") === "thesis");
  const marketwatch = trades.filter((trade) => trade.source === "marketwatch");

  return {
    thesis: calculateRealizedAnalytics(thesis),
    marketwatch: calculateRealizedAnalytics(marketwatch),
  };
}

function resolveOutcomeValue(trade: Trade, kind: OutcomeKind): number | null {
  if (kind === "modeled") {
    return estimateModeledRMultiple(trade);
  }

  return resolveRealizedOutcome(trade)?.rMultiple ?? null;
}

function resolveStrategyLabel(trade: Trade): string {
  if (typeof trade.strategy_name === "string" && trade.strategy_name.trim()) {
    return trade.strategy_name;
  }

  const snapshot = trade.strategy_snapshot;
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) && typeof snapshot.name === "string") {
    return snapshot.name;
  }

  return "Legacy strategy";
}

export function analyticsBySetup(trades: Trade[], kind: OutcomeKind = "modeled"): { [setup: string]: { count: number; avgR: number } } {
  const setupMap: Record<string, { sumR: number; count: number }> = {};

  trades.forEach((trade) => {
    const tradeR = resolveOutcomeValue(trade, kind);
    if (tradeR == null) {
      return;
    }
    const setups = trade.setup_types ?? [];

    setups.forEach((setup) => {
      if (!setupMap[setup]) {
        setupMap[setup] = { sumR: 0, count: 0 };
      }
      setupMap[setup].sumR += tradeR;
      setupMap[setup].count += 1;
    });
  });

  return Object.fromEntries(
    Object.entries(setupMap).map(([setup, stats]) => [
      setup,
      {
        count: stats.count,
        avgR: stats.count ? stats.sumR / stats.count : 0,
      },
    ]),
  );
}

export function analyticsByStrategy(trades: Trade[], kind: OutcomeKind = "modeled"): { [strategy: string]: { count: number; avgR: number } } {
  const strategyMap: Record<string, { sumR: number; count: number }> = {};

  trades.forEach((trade) => {
    const tradeR = resolveOutcomeValue(trade, kind);
    if (tradeR == null) {
      return;
    }

    const strategyLabel = resolveStrategyLabel(trade);
    if (!strategyMap[strategyLabel]) {
      strategyMap[strategyLabel] = { sumR: 0, count: 0 };
    }
    strategyMap[strategyLabel].sumR += tradeR;
    strategyMap[strategyLabel].count += 1;
  });

  return Object.fromEntries(
    Object.entries(strategyMap).map(([strategy, stats]) => [
      strategy,
      {
        count: stats.count,
        avgR: stats.count ? stats.sumR / stats.count : 0,
      },
    ]),
  );
}

export function buildCumulativeRSeries(trades: Trade[], kind: OutcomeKind = "modeled"): Array<{ idx: number; cumulativeR: number; fill: string }> {
  let running = 0;

  return trades.flatMap((trade, index) => {
    const rValue = resolveOutcomeValue(trade, kind);
    if (rValue == null) {
      return [];
    }

    running += rValue;
    return [{
      idx: index + 1,
      cumulativeR: Number(running.toFixed(2)),
      fill: running >= 0 ? "#0b8a66" : "#dc4c38",
    }];
  });
}