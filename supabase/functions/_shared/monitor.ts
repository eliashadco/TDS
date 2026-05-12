/**
 * Pure trade monitoring evaluator (canon §10.1).
 * Caller supplies frozen monitoring rules, trade levels, and live evidence — no I/O.
 *
 * This file is the Deno-edge-function copy of lib/trading/monitor.ts.
 * Both must stay in sync; the Next.js app imports from lib/trading/monitor.ts.
 */

export interface MonitorCheckResult {
  tradeId: string;
  ranAt: string;
  compliant: boolean;
  breaches: Array<{ rule: string; detail: string; evidenceId?: string }>;
  silentUpdates: Array<{ kind: string; summary: string; evidenceId?: string }>;
  alert: null | {
    type: "invalidation_breached" | "sl_hit" | "target_hit" | "sl_proximity";
    detail: string;
  };
}

export interface FrozenMonitoringRules {
  cadence_seconds: number;
  invalidation_conditions: unknown;
  silent_update_thresholds: unknown;
}

export interface TradeLevelsSnapshot {
  direction: "LONG" | "SHORT";
  entry_price: number | null;
  stop_loss: number | null;
  /** Profit targets (caller resolves from plan / r2 / r4 / legacy exits). */
  targets?: number[] | null;
}

export interface MonitorMarketSnapshot {
  lastPrice: number;
  high?: number;
  low?: number;
  evidenceId?: string;
}

export interface MonitorAuxSignals {
  /** Structural / thesis invalidation already evaluated by caller pipelines. */
  invalidationBreached?: boolean;
  invalidationDetail?: string;
  parameterDrifts?: Array<{ name: string; locked: string; observed: string }>;
}

export interface EvaluateMonitorInput {
  tradeId: string;
  ranAt: string;
  rules: FrozenMonitoringRules;
  trade: TradeLevelsSnapshot;
  /** When null, no price-based alerts fire (Hard Rule: no phantom alerts without data). */
  market: MonitorMarketSnapshot | null;
  aux?: MonitorAuxSignals;
}

function readNumericThreshold(root: unknown, key: string): number | null {
  if (!root || typeof root !== "object") return null;
  const v = (root as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pickAlert(
  candidates: Array<{ type: NonNullable<MonitorCheckResult["alert"]>["type"]; detail: string }>,
): MonitorCheckResult["alert"] {
  const priority: NonNullable<MonitorCheckResult["alert"]>["type"][] = [
    "sl_hit",
    "invalidation_breached",
    "target_hit",
    "sl_proximity",
  ];
  for (const p of priority) {
    const hit = candidates.find((c) => c.type === p);
    if (hit) return { type: hit.type, detail: hit.detail };
  }
  return null;
}

/**
 * Evaluate monitoring compliance and classify canon §10.1 critical alerts vs silent updates (Hard Rule 7).
 */
export function evaluateMonitor(input: EvaluateMonitorInput): MonitorCheckResult {
  const { tradeId, ranAt, rules, trade, market, aux } = input;
  const breaches: MonitorCheckResult["breaches"] = [];
  const silentUpdates: MonitorCheckResult["silentUpdates"] = [];
  const thresholds = rules.silent_update_thresholds;

  if (!market) {
    silentUpdates.push({
      kind: "context_change",
      summary: "Live quote unavailable; critical price alerts deferred to next cadence.",
    });
    return { tradeId, ranAt, compliant: true, breaches, silentUpdates, alert: null };
  }

  const last = market.lastPrice;
  const high = Number.isFinite(market.high ?? NaN) ? (market.high as number) : last;
  const low = Number.isFinite(market.low ?? NaN) ? (market.low as number) : last;
  const evId = market.evidenceId;

  for (const d of aux?.parameterDrifts ?? []) {
    breaches.push({
      rule: `parameter:${d.name}`,
      detail: `Locked ${d.locked}; observed ${d.observed}`,
      evidenceId: evId,
    });
    silentUpdates.push({
      kind: "parameter_drift",
      summary: `${d.name}: locked vs observed divergence`,
      evidenceId: evId,
    });
  }

  if (aux?.invalidationBreached) {
    breaches.push({
      rule: "invalidation",
      detail: aux.invalidationDetail ?? "Invalidation condition signaled",
      evidenceId: evId,
    });
  }

  const stop = trade.stop_loss;
  const entry = trade.entry_price;
  const dir = trade.direction;

  let slHit = false;
  let slDetail = "";
  if (typeof stop === "number" && stop > 0) {
    if (dir === "LONG" && low <= stop) {
      slHit = true;
      slDetail = `Low ${low} at or below stop ${stop}.`;
    } else if (dir === "SHORT" && high >= stop) {
      slHit = true;
      slDetail = `High ${high} at or above stop ${stop}.`;
    }
  }

  const targets = (trade.targets ?? []).filter((t) => typeof t === "number" && Number.isFinite(t));
  let targetHit = false;
  let targetDetail = "";
  for (const t of targets) {
    if (dir === "LONG" && high >= t) {
      targetHit = true;
      targetDetail = `High ${high} reached target ${t}.`;
      break;
    }
    if (dir === "SHORT" && low <= t) {
      targetHit = true;
      targetDetail = `Low ${low} reached target ${t}.`;
      break;
    }
  }

  let proximity = false;
  let proxDetail = "";
  const proxFrac = readNumericThreshold(thresholds, "sl_proximity_risk_fraction");
  if (
    !slHit &&
    proxFrac != null &&
    proxFrac > 0 &&
    proxFrac < 1 &&
    typeof entry === "number" &&
    typeof stop === "number" &&
    entry > 0 &&
    stop > 0 &&
    entry !== stop
  ) {
    const riskDist = dir === "LONG" ? entry - stop : stop - entry;
    if (riskDist > 0) {
      const distToStop = dir === "LONG" ? last - stop : stop - last;
      if (distToStop > 0 && distToStop < riskDist) {
        const exhausted = 1 - distToStop / riskDist;
        if (exhausted >= 1 - proxFrac) {
          proximity = true;
          proxDetail = `Price ${last} within ${Math.round(proxFrac * 100)}% of planned risk toward stop ${stop}.`;
        }
      }
    }
  }

  const alertCandidates: Array<{ type: NonNullable<MonitorCheckResult["alert"]>["type"]; detail: string }> = [];
  if (slHit) alertCandidates.push({ type: "sl_hit", detail: slDetail });
  if (aux?.invalidationBreached) {
    alertCandidates.push({
      type: "invalidation_breached",
      detail: aux.invalidationDetail ?? "Invalidation breached.",
    });
  }
  if (targetHit) alertCandidates.push({ type: "target_hit", detail: targetDetail });
  if (proximity) alertCandidates.push({ type: "sl_proximity", detail: proxDetail });

  const alert = pickAlert(alertCandidates);

  if (slHit) breaches.push({ rule: "stop_loss", detail: slDetail, evidenceId: evId });
  if (proximity && !slHit) breaches.push({ rule: "sl_proximity", detail: proxDetail, evidenceId: evId });

  const driftPct = readNumericThreshold(thresholds, "silent_price_move_pct");
  if (driftPct != null && typeof entry === "number" && entry > 0) {
    const movePct = Math.abs((last - entry) / entry) * 100;
    if (movePct >= driftPct) {
      silentUpdates.push({
        kind: "price_drift",
        summary: `Price moved ${movePct.toFixed(2)}% from entry ${entry} (silent threshold ${driftPct}%).`,
        evidenceId: evId,
      });
    }
  }

  const hadStructuralBreach =
    slHit ||
    aux?.invalidationBreached === true ||
    (aux?.parameterDrifts?.length ?? 0) > 0 ||
    proximity;

  return {
    tradeId,
    ranAt,
    compliant: !hadStructuralBreach,
    breaches,
    silentUpdates,
    alert,
  };
}
