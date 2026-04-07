import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { Resend } from "npm:resend@6.10.0";
import { renderNotificationEmail } from "../_shared/email.tsx";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_FROM_EMAIL = Deno.env.get("ALERT_FROM_EMAIL") ?? "alerts@tds.local";

Deno.serve(async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing required environment variables" }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const resend = new Resend(RESEND_API_KEY);

  const nowIso = new Date().toISOString();
  const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data: trades, error } = await supabase
    .from("trades")
    .select("ticker, shares, tranche2_deadline, user_id")
    .eq("tranche2_filled", false)
    .eq("closed", false)
    .not("tranche2_deadline", "is", null)
    .lte("tranche2_deadline", inTwoDays)
    .gte("tranche2_deadline", nowIso);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;

  for (const trade of trades ?? []) {
    const deadline = new Date(trade.tranche2_deadline as string);
    const days = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", trade.user_id)
      .maybeSingle();

    const to = profile?.email;
    if (!to) {
      continue;
    }

    const html = renderNotificationEmail({
      title: `Intelligent Investors Alert: ${trade.ticker} tranche deadline`,
      preheader: `${trade.ticker} tranche 2 deadline in ${days} day(s).`,
      body: `Intelligent Investors Alert: ${trade.ticker} tranche 2 deadline in ${days} day(s). ${trade.shares ?? 0} shares must be deployed.`,
      bullets: [
        `Ticker: ${trade.ticker}`,
        `Shares to deploy: ${trade.shares ?? 0}`,
        `Deadline: ${deadline.toLocaleString("en-US")}`,
      ],
    });

    const { error: sendError } = await resend.emails.send({
      from: ALERT_FROM_EMAIL,
      to,
      subject: `Intelligent Investors Alert: ${trade.ticker} tranche deadline`,
      html,
    });

    if (!sendError) {
      sent += 1;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
});
