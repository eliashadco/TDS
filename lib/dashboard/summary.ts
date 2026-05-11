import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { DashboardSummary } from "@/types/dashboard-summary";
import { MAX_PORTFOLIO_HEAT } from "@/lib/trading/validation";
import { loadCircuitBreakerStatus } from "@/lib/trading/circuit-breaker-load";

function taskReason(taskType: string, payload: Json): string {
  const p = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  if (typeof p.reason === "string" && p.reason.trim()) {
    return p.reason.trim();
  }
  switch (taskType) {
    case "draft_due":
      return "Draft workflow step is due.";
    case "review_due":
      return "Post-trade review is due.";
    case "monitor_check_due":
      return "Parameter monitor check is due.";
    case "blocker_clear":
      return "Clear draft blockers to proceed.";
    default:
      return `Workflow task: ${taskType}`;
  }
}

function summarizeDecisionEvent(eventType: string, payload: Json): string {
  const p = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  switch (eventType) {
    case "trade.deployed":
      return typeof p.ticker === "string" ? `Deployed ${p.ticker}` : "Trade deployed";
    case "trade.closed":
      return typeof p.ticker === "string" ? `Closed ${p.ticker}` : "Trade closed";
    case "trade.monitor_check":
      return p.alertFired
        ? `Monitor check · alert ${String(p.alertFired)}`
        : "Monitor check completed";
    case "trade.alert_fired":
      return typeof p.alert_type === "string" ? `Critical alert: ${p.alert_type}` : "Critical alert fired";
    case "trade.reviewed":
      return "Post-trade review submitted";
    case "draft.ready":
      return "Draft marked ready";
    case "draft.planned":
      return "Draft planned";
    case "draft.challenged":
      return "Draft challenged";
    default:
      return eventType.replace(/\./g, " · ");
  }
}

/** Prefer persisted breaker snapshots when emitted to trade_events; otherwise derive from closed-trade streak + equity drawdown. */
async function resolveCircuitBreakerSummary(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DashboardSummary["circuitBreaker"]> {
  const evaluated = await loadCircuitBreakerStatus(supabase, userId);

  const { data: snapRows } = await supabase
    .from("trade_events")
    .select("payload")
    .eq("user_id", userId)
    .eq("event_type", "circuit.breaker_snapshot")
    .order("created_at", { ascending: false })
    .limit(1);

  const snap = snapRows?.[0]?.payload as Record<string, unknown> | undefined;
  if (snap && typeof snap.active === "boolean") {
    return {
      active: snap.active,
      reason: typeof snap.reason === "string" ? snap.reason : evaluated.reason ?? undefined,
      restingUntil: typeof snap.resting_until === "string" ? snap.resting_until : undefined,
    };
  }

  return {
    active: evaluated.tripped,
    reason: evaluated.reason ?? undefined,
    restingUntil: undefined,
  };
}

/**
 * Server-owned dashboard summary — drafts + trades + workflow_tasks + trade_events (PR 6).
 */
export async function buildDashboardSummary(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DashboardSummary> {
  const [
    { data: draftRows },
    { data: openTradeRiskRows },
    { data: closedTradeIds },
    { data: reviewedRows },
    { data: taskRows },
    { data: eventRows },
  ] = await Promise.all([
    supabase.from("trade_drafts").select("state").eq("user_id", userId),
    supabase
      .from("trades")
      .select("risk_pct")
      .eq("user_id", userId)
      .eq("confirmed", true)
      .eq("closed", false),
    supabase.from("trades").select("id").eq("user_id", userId).eq("closed", true),
    supabase.from("trade_reviews").select("trade_id").eq("user_id", userId),
    supabase
      .from("workflow_tasks")
      .select("id, task_type, entity_id, due_at, payload")
      .eq("user_id", userId)
      .is("completed_at", null)
      .order("due_at", { ascending: true })
      .limit(40),
    supabase
      .from("trade_events")
      .select("created_at, event_type, payload")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(14),
  ]);

  const drafts = draftRows ?? [];
  let staged = 0;
  let planned = 0;
  let ready = 0;
  for (const d of drafts) {
    const s = d.state as string;
    if (s === "observed" || s === "qualified") staged += 1;
    else if (s === "planned") planned += 1;
    else if (s === "ready") ready += 1;
  }

  const live = (openTradeRiskRows ?? []).length;

  const reviewedSet = new Set((reviewedRows ?? []).map((r) => r.trade_id));
  const reviewDue = (closedTradeIds ?? []).filter((r) => !reviewedSet.has(r.id)).length;

  let portfolioHeatPct = 0;
  for (const row of openTradeRiskRows ?? []) {
    const rp = row.risk_pct;
    portfolioHeatPct += typeof rp === "number" && Number.isFinite(rp) ? rp * 100 : 0;
  }

  const actNow = (taskRows ?? []).map((t) => ({
    taskId: t.id,
    type: t.task_type,
    entityId: t.entity_id ?? "",
    dueAt: t.due_at,
    reason: taskReason(t.task_type, t.payload),
  }));

  const circuitBreaker = await resolveCircuitBreakerSummary(supabase, userId);

  const recentDecisions = (eventRows ?? []).map((e) => ({
    at: e.created_at,
    eventType: e.event_type,
    summary: summarizeDecisionEvent(e.event_type, e.payload),
  }));

  return {
    pipelineCounts: {
      staged,
      planned,
      ready,
      live,
      reviewDue,
    },
    actNow,
    riskState: {
      portfolioHeatPct,
      cap: MAX_PORTFOLIO_HEAT,
      openTrades: live,
    },
    circuitBreaker,
    recentDecisions,
  };
}
