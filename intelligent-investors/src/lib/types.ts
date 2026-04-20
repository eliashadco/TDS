export type TradingMode = 'investment' | 'swing' | 'daytrade' | 'scalp';
export type Direction = 'LONG' | 'SHORT';
export type TradeStatus = 'PLANNING' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
export type ConvictionTier = 'NONE' | 'STANDARD' | 'HIGH' | 'MAXIMUM';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  mode: TradingMode;
  learnMode: boolean;
  equity: number;
  riskPerTrade: number; // as % of equity
  createdAt: any;
  updatedAt: any;
}

export interface Metric {
  id: string;
  name: string;
  category: string;
  description: string;
  longInterpretation: string;
  shortInterpretation: string;
  weight: number;
  isRequired: boolean;
}

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  mode: TradingMode;
  version: number;
  metrics: Metric[];
  aiInstructions: string;
  isDefault: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface TradeAssessment {
  metrics: {
    [metricId: string]: {
      passed: boolean;
      score: number;
      reasoning: string;
    };
  };
  verdict: 'PASS' | 'FAIL' | 'CAUTION';
  summary: string;
  edge: string;
  risks: string;
  fundamentalScore: number;
  technicalScore: number;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  ticker: string;
  direction: Direction;
  mode: TradingMode;
  strategyId?: string;
  strategySnapshot?: Strategy;
  scores?: TradeAssessment;
  verdict?: 'GO' | 'CAUTION' | 'SKIP';
  conviction?: ConvictionTier;
  entry?: number;
  stop?: number;
  note?: string;
  status: 'WATCH' | 'SCORED';
  lastScoredAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  sector?: string;
  direction: Direction;
  mode: TradingMode;
  strategyId: string;
  strategySnapshot: Strategy;
  
  // Mechanical System Fields
  thesis: string;
  catalystWindow: string;
  invalidationCondition: string;
  
  fundamentalScore: number; // 0-5
  technicalScore: number;   // 0-3
  isOverride: boolean;
  
  assessment?: TradeAssessment;
  conviction: ConvictionTier;
  
  // Execution
  positionSize: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  
  status: TradeStatus;
  source: 'MANUAL' | 'MARKETWATCH';
  setup?: {
    type: string;
    condition: string;
    pattern: string;
  };
  trancheStatus?: {
    t1Entered: boolean;
    t2Entered: boolean;
    t1Exited: boolean;
    t2Exited: boolean;
    t3Exited: boolean;
  };
  tranches?: {
    id: string;
    shares: number;
    entryPrice: number;
    targetPrice: number;
    status: 'PENDING' | 'FILLED' | 'CANCELLED';
    filledAt?: any;
  }[];
  journals: {
    timestamp: any;
    content: string;
    type: 'NOTE' | 'REASSESSMENT' | 'EXIT_REVIEW' | 'SYSTEM';
  }[];
  outcome?: {
    exitPrice: number;
    exitTimestamp: any;
    pnl: number;
    rMultiple: number;
  };
  createdAt: any;
  updatedAt: any;
}
