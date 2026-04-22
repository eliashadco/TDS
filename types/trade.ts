export interface Metric {
  id: string;
  name: string;
  description: string;
  category: "val" | "quality" | "mom" | "risk" | "macro" | "trend" | "vol" | "intra" | "struct";
  type: "fundamental" | "technical";
  enabled: boolean;
  /** TRD v2 §5.2 — Hard rules block execution (profile-dependent), soft rules affect score only */
  isHard?: boolean;
}

export interface TradeThesis {
  ticker: string;
  direction: "LONG" | "SHORT";
  setupTypes: string[];
  conditions: string[];
  chartPattern: string;
  thesis: string;
  catalystWindow: string;
  invalidation: string;
}

export interface TradeScores {
  [metricId: string]: 0 | 1;
}

export interface TradeNotes {
  [metricId: string]: string;
}

export interface ConvictionTier {
  tier: "MAX" | "HIGH" | "STD";
  risk: number;
  color: string;
}

export interface Position {
  shares: number;
  value: number;
  risk: number;
  rPerShare: number;
  tranche1: number;
  tranche2: number;
  r2Target: number;
  r4Target: number;
}

export interface AIInsight {
  verdict: "GO" | "CAUTION" | "STOP";
  summary: string;
  risks?: string;
  edge?: string;
}

export type TradeSource = "thesis" | "marketwatch";
export type TradeMode = "investment" | "swing" | "daytrade" | "scalp";

/* ---------- Trade lifecycle (TRD v2 §22.1) ---------- */
export type TradeState = "initiated" | "evaluated" | "blocked" | "deployed" | "overridden" | "closed";
export type TradeClassification = "in_policy" | "override" | "out_of_bounds";
export type DisciplineProfile = "strict" | "balanced" | "expert";
export type OverrideQuality = "valid" | "low_quality" | "high_risk";

export interface Override {
  id: string;
  trade_id: string;
  user_id: string;
  rules_broken: string[];
  justification: string;
  quality_flag: OverrideQuality;
  ai_audit: Record<string, unknown> | null;
  timer_duration_sec: number;
  created_at: string;
}

export interface DisciplineMetrics {
  id: string;
  user_id: string;
  strategy_id: string | null;
  score: number;
  period: string;
  in_policy_count: number;
  override_count: number;
  oob_count: number;
  pnl_in_policy: number;
  pnl_override: number;
  pnl_oob: number;
  created_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  strategy_id: string | null;
  strategy_version_id: string | null;
  strategy_name: string | null;
  strategy_snapshot: Record<string, unknown> | null;
  ticker: string;
  direction: "LONG" | "SHORT";
  asset_class: string;
  mode: TradeMode;
  setup_types: string[];
  conditions: string[];
  chart_pattern: string;
  thesis: string;
  catalyst_window: string | null;
  invalidation: string;
  scores: Record<string, 0 | 1>;
  notes: Record<string, string>;
  f_score: number;
  t_score: number;
  f_total: number;
  t_total: number;
  conviction: "MAX" | "HIGH" | "STD" | null;
  risk_pct: number | null;
  entry_price: number | null;
  stop_loss: number | null;
  shares: number;
  tranche1_shares: number;
  tranche2_shares: number;
  tranche2_filled: boolean;
  tranche2_deadline: string | null;
  exit_t1: boolean;
  exit_t2: boolean;
  exit_t3: boolean;
  exit_price: number | null;
  r2_target: number | null;
  r4_target: number | null;
  market_price: number | null;
  source: TradeSource;
  state: TradeState;
  classification: TradeClassification;
  confirmed: boolean;
  closed: boolean;
  closed_at: string | null;
  closed_reason: string | null;
  journal_entry: string;
  journal_exit: string;
  journal_post: string;
  insight: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}