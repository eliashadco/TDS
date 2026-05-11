import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { Resend } from "npm:resend@6.10.0";
import { renderNotificationEmail } from "../_shared/email.tsx";
import { assertServiceRole } from "../_shared/service-auth.ts";

const ALLOWED_ALERTS = new Set([
  "invalidation_breached",
  "sl_hit",
  "target_hit",
  "sl_proximity",
]);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_FROM_EMAIL = Deno.env.get("ALERT_FROM_EMAIL") ?? "alerts@tds.local";

type Body = { monitorCheckId?: string };

function alertTitle(type: string): string {
  switch (type) {
    case "sl_hit":
      return "Stop loss touched";
    case "invalidation_breached":
      return "Invalidation breached";
    case "target_hit":
      return "Profit target reached";
    case "sl_proximity":
      return "Stop proximity warning";
    default:
      return "Trade alert";
  }
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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const monitorCheckId = body.monitorCheckId;
  if (!monitorCheckId) {
    return new Response(JSON.stringify({ error: "monitorCheckId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: dupRows } = await supabase
    .from("trade_events")
    .select("id")
    .eq("event_type", "trade.alert_fired")
    .contains("payload", { monitor_check_id: monitorCheckId })
    .limit(1);

  if (dupRows && dupRows.length > 0) {
    return new Response(JSON.stringify({ ok: true, idempotent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: check, error: checkErr } = await supabase
    .from("trade_monitor_checks")
    .select("id, trade_id, alert_fired, result")
    .eq("id", monitorCheckId)
    .single();

  if (checkErr || !check) {
    return new Response(JSON.stringify({ error: "monitor_check not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const alertType = check.alert_fired;
  if (!alertType || !ALLOWED_ALERTS.has(alertType)) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = check.result as { alert?: { detail?: string } | null };

  const { data: trade, error: tradeErr } = await supabase
    .from("trades")
    .select("user_id, ticker")
    .eq("id", check.trade_id)
    .single();

  if (tradeErr || !trade) {
    return new Response(JSON.stringify({ error: "trade not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", trade.user_id)
    .maybeSingle();

  const to = profile?.email;
  if (!to) {
    return new Response(JSON.stringify({ ok: false, error: "no_trader_email" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const detail = result?.alert?.detail ?? `${alertType} on trade ${trade.ticker}`;
  const title = `${alertTitle(alertType)} · ${trade.ticker}`;
  const html = renderNotificationEmail({
    title,
    preheader: detail.slice(0, 140),
    body: detail,
    bullets: [alertType, `Trade ID: ${check.trade_id}`],
  });

  const resend = new Resend(RESEND_API_KEY);
  const { error: sendError } = await resend.emails.send({
    from: ALERT_FROM_EMAIL,
    to,
    subject: `TDS Critical: ${trade.ticker} — ${alertTitle(alertType)}`,
    html,
  });

  if (sendError) {
    return new Response(JSON.stringify({ error: sendError.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error: evErr } = await supabase.from("trade_events").insert({
    user_id: trade.user_id,
    entity_type: "trade",
    entity_id: check.trade_id,
    event_type: "trade.alert_fired",
    payload: {
      monitor_check_id: monitorCheckId,
      alert_type: alertType,
    },
  });

  if (evErr) {
    return new Response(JSON.stringify({ error: evErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, sent: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
