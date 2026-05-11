import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { evaluateMonitor, type MonitorCheckResult } from "../_shared/monitor.ts";
import { fetchLiveQuoteOHLC } from "../_shared/market-quotes.ts";
import { isWhitelistedEvidenceSource } from "../_shared/evidence-sources.ts";
import { assertServiceRole } from "../_shared/service-auth.ts";

const SILENT_KINDS = new Set(["context_change", "price_drift", "news", "parameter_drift"]);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const POLYGON_API_KEY = Deno.env.get("POLYGON_API_KEY") ?? "";

type MonitoringRulesPayload = {
  cadence_seconds: number;
  invalidation_conditions: unknown;
  silent_update_thresholds: unknown;
  critical_alert_routing: unknown;
};

type TradeDueRow = {
  id: string;
  user_id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  entry_price: number | null;
  stop_loss: number | null;
  r2_target: number | null;
  r4_target: number | null;
  trade_monitoring_rules: MonitoringRulesPayload | MonitoringRulesPayload[] | null;
};

function monitoringRules(row: TradeDueRow): MonitoringRulesPayload | null {
  const raw = row.trade_monitoring_rules;
  if (Array.isArray(raw)) return raw[0] ?? null;
  if (raw && typeof raw === "object") return raw;
  return null;
}

function targetsFromTrade(t: TradeDueRow): number[] {
  const xs: number[] = [];
  if (typeof t.r2_target === "number" && Number.isFinite(t.r2_target)) xs.push(t.r2_target);
  if (typeof t.r4_target === "number" && Number.isFinite(t.r4_target)) xs.push(t.r4_target);
  return xs;
}

async function persistSilentFallback(
  supabase: ReturnType<typeof createClient>,
  tradeId: string,
  result: MonitorCheckResult,
): Promise<void> {
  for (const su of result.silentUpdates) {
    if (!SILENT_KINDS.has(su.kind)) continue;
    await supabase.from("trade_silent_updates").insert({
      trade_id: tradeId,
      kind: su.kind as "context_change" | "price_drift" | "news" | "parameter_drift",
      summary: su.summary,
      evidence_id: su.evidenceId ?? null,
    });
  }
}

async function invokeEdgeFunction(path: string, body: Record<string, unknown>): Promise<boolean> {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  const deny = assertServiceRole(req, SUPABASE_SERVICE_ROLE_KEY);
  if (deny) return deny;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const polygonTier = Deno.env.get("POLYGON_TIER") ?? "";
  const nodeEnv = Deno.env.get("NODE_ENV") ?? "";
  if (polygonTier === "free" && nodeEnv === "production") {
    return new Response(
      JSON.stringify({
        error: {
          code: "POLYGON_TIER_TOO_LOW",
          message: "Production monitoring refuses Polygon free tier (Hard Rule 10); no phantom alerts.",
        },
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const nowIso = new Date().toISOString();

  const { data: trades, error: qErr } = await supabase
    .from("trades")
    .select(
      `
      id,
      user_id,
      ticker,
      direction,
      entry_price,
      stop_loss,
      r2_target,
      r4_target,
      trade_monitoring_rules (
        cadence_seconds,
        invalidation_conditions,
        silent_update_thresholds,
        critical_alert_routing
      )
    `,
    )
    .eq("closed", false)
    .lte("next_parameter_check_at", nowIso);

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  const failures: string[] = [];

  for (const rawTrade of trades ?? []) {
    const trade = rawTrade as TradeDueRow;
    const ruleRow = monitoringRules(trade);
    if (!ruleRow) {
      failures.push(`${trade.id}:missing_monitoring_rules`);
      continue;
    }

    const ranAt = new Date().toISOString();

    const quote = await fetchLiveQuoteOHLC(trade.ticker, POLYGON_API_KEY || undefined);

    let evidenceId: string | undefined;

    if (quote && isWhitelistedEvidenceSource(quote.source_label)) {
      const { data: evRow, error: evErr } = await supabase
        .from("trade_evidence_records")
        .insert({
          user_id: trade.user_id,
          trade_id: trade.id,
          provider: quote.source_label === "polygon" ? "polygon" : "yahoo",
          source_label: quote.source_label,
          citation_url: null,
          normalized_payload: {
            last: quote.last,
            high: quote.high,
            low: quote.low,
            ticker: trade.ticker,
            captured_as_of: ranAt,
          },
          silent_update: true,
        })
        .select("id")
        .single();

      if (!evErr && evRow?.id) {
        evidenceId = evRow.id;
      }
    }

    const market =
      quote && quote.last > 0
        ? {
            lastPrice: quote.last,
            high: quote.high,
            low: quote.low,
            evidenceId,
          }
        : null;

    const result = evaluateMonitor({
      tradeId: trade.id,
      ranAt,
      rules: {
        cadence_seconds: ruleRow.cadence_seconds,
        invalidation_conditions: ruleRow.invalidation_conditions,
        silent_update_thresholds: ruleRow.silent_update_thresholds,
      },
      trade: {
        direction: trade.direction,
        entry_price: trade.entry_price,
        stop_loss: trade.stop_loss,
        targets: targetsFromTrade(trade),
      },
      market,
      aux: undefined,
    });

    const { data: checkRow, error: checkErr } = await supabase
      .from("trade_monitor_checks")
      .insert({
        trade_id: trade.id,
        ran_at: result.ranAt,
        result: result as Record<string, unknown>,
        alert_fired: result.alert?.type ?? null,
      })
      .select("id")
      .single();

    if (checkErr || !checkRow) {
      failures.push(`${trade.id}:${checkErr?.message ?? "check_insert"}`);
      continue;
    }

    const cadence = ruleRow.cadence_seconds > 0 ? ruleRow.cadence_seconds : 86_400;
    const nextCheckAt = new Date(Date.now() + cadence * 1000).toISOString();

    await supabase
      .from("trades")
      .update({
        last_parameter_check_at: result.ranAt,
        last_parameter_check_result: result as Record<string, unknown>,
        next_parameter_check_at: nextCheckAt,
      })
      .eq("id", trade.id);

    await supabase
      .from("trade_monitoring_rules")
      .update({
        last_parameter_check_at: result.ranAt,
        last_parameter_check_result: result as Record<string, unknown>,
        next_parameter_check_at: nextCheckAt,
        updated_at: ranAt,
      })
      .eq("trade_id", trade.id);

    await supabase.from("trade_events").insert({
      user_id: trade.user_id,
      entity_type: "trade",
      entity_id: trade.id,
      event_type: "trade.monitor_check",
      payload: {
        ranAt: result.ranAt,
        compliant: result.compliant,
        alertFired: result.alert?.type ?? null,
        breachCount: result.breaches.length,
        monitor_check_id: checkRow.id,
      },
    });

    const silentOk = await invokeEdgeFunction("/functions/v1/trade-evidence-updater", {
      monitorCheckId: checkRow.id,
    });
    if (!silentOk) {
      await persistSilentFallback(supabase, trade.id, result);
    }

    if (result.alert) {
      await invokeEdgeFunction("/functions/v1/critical-event-notifier", {
        monitorCheckId: checkRow.id,
      });
    }

    processed += 1;
  }

  return new Response(JSON.stringify({ ok: true, processed, failures }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
