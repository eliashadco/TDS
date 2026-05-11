/** Canon §7.1 — server-owned dashboard read model (PR 6). */
export interface DashboardSummary {
  pipelineCounts: {
    staged: number;
    planned: number;
    ready: number;
    live: number;
    reviewDue: number;
  };
  actNow: Array<{
    taskId: string;
    type: string;
    entityId: string;
    dueAt: string;
    reason: string;
  }>;
  riskState: {
    portfolioHeatPct: number;
    cap: number;
    openTrades: number;
  };
  circuitBreaker: {
    active: boolean;
    reason?: string;
    restingUntil?: string;
  };
  recentDecisions: Array<{
    at: string;
    eventType: string;
    summary: string;
  }>;
}
