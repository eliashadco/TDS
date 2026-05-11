import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { assertServiceRole } from "../_shared/service-auth.ts";
import { isWhitelistedEvidenceSource } from "../_shared/evidence-sources.ts";

const SILENT_KINDS = new Set(["context_change", "price_drift", "news", "parameter_drift"]);

type EvidenceInsert = {
  user_id: string;
  trade_id?: string | null;
  draft_id?: string | null;
  provider: string;
  source_label: string;
  citation_url?: string | null;
  normalized_payload: Record<string, unknown>;
  silent_update?: boolean;
};

type Body = {
  monitorCheckId?: string;
  evidenceRecords?: EvidenceInsert[];
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  const deny = assertServiceRole(req, SUPABASE_SERVICE_ROLE_KEY);
  if (deny) return deny;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (body.monitorCheckId) {
    const { data: dupRows } = await supabase
      .from("trade_events")
      .select("id")
      .eq("event_type", "trade.silent_update")
      .contains("payload", { monitor_check_id: body.monitorCheckId })
      .limit(1);

    if (dupRows && dupRows.length > 0) {
      return new Response(JSON.stringify({ ok: true, idempotent: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: row, error: rowErr } = await supabase
      .from("trade_monitor_checks")
      .select("trade_id, result")
      .eq("id", body.monitorCheckId)
      .single();

    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "monitor_check not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = row.result as { silentUpdates?: Array<{ kind: string; summary: string; evidenceId?: string }> };
    for (const su of result.silentUpdates ?? []) {
      if (!SILENT_KINDS.has(su.kind)) continue;
      const { error: insErr } = await supabase.from("trade_silent_updates").insert({
        trade_id: row.trade_id,
        kind: su.kind as "context_change" | "price_drift" | "news" | "parameter_drift",
        summary: su.summary,
        evidence_id: su.evidenceId ?? null,
      });
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const { error: evErr } = await supabase.from("trade_events").insert({
      entity_type: "trade",
      entity_id: row.trade_id,
      event_type: "trade.silent_update",
      payload: {
        monitor_check_id: body.monitorCheckId,
        silent_update_count: (result.silentUpdates ?? []).filter((su) => SILENT_KINDS.has(su.kind)).length,
      },
    });

    if (evErr) {
      return new Response(JSON.stringify({ error: evErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  for (const rec of body.evidenceRecords ?? []) {
    if (!isWhitelistedEvidenceSource(rec.source_label)) {
      continue;
    }
    const { error: evErr } = await supabase.from("trade_evidence_records").insert({
      user_id: rec.user_id,
      trade_id: rec.trade_id ?? null,
      draft_id: rec.draft_id ?? null,
      provider: rec.provider,
      source_label: rec.source_label.trim().toLowerCase(),
      citation_url: rec.citation_url ?? null,
      normalized_payload: rec.normalized_payload,
      silent_update: rec.silent_update ?? true,
    });
    if (evErr) {
      return new Response(JSON.stringify({ error: evErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
