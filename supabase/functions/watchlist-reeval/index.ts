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

  const staleIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleRows, error } = await supabase
    .from("watchlist_items")
    .select("user_id, ticker, last_scored_at")
    .or(`last_scored_at.is.null,last_scored_at.lt.${staleIso}`);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const grouped = new Map<string, string[]>();
  for (const row of staleRows ?? []) {
    const list = grouped.get(row.user_id) ?? [];
    list.push(row.ticker);
    grouped.set(row.user_id, list);
  }

  let sent = 0;

  for (const [userId, tickers] of grouped.entries()) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    const to = profile?.email;
    if (!to) {
      continue;
    }

    const count = tickers.length;
    const uniqueTickers = Array.from(new Set(tickers)).slice(0, 30);

    const html = renderNotificationEmail({
      title: "TDS Weekly Watchlist Re-evaluation",
      preheader: `You have ${count} watchlist items to re-score.`,
      body: `TDS Weekly: You have ${count} watchlist items to re-evaluate: ${uniqueTickers.join(", ")}`,
      bullets: uniqueTickers.map((ticker) => `Review ${ticker}`),
    });

    const { error: sendError } = await resend.emails.send({
      from: ALERT_FROM_EMAIL,
      to,
      subject: `TDS Weekly: ${count} watchlist item(s) to re-evaluate`,
      html,
    });

    if (!sendError) {
      sent += 1;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
});
