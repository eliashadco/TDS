import "server-only";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type TradeEventType =
  | "draft.created"
  | "draft.intake_extracted"
  | "draft.field_confirmed"
  | "draft.planned"
  | "draft.challenged"
  | "draft.ready"
  | "draft.archived"
  | "trade.deployed"
  | "trade.monitor_check"
  | "trade.silent_update"
  | "trade.alert_fired"
  | "trade.closed"
  | "trade.reviewed"
  | "circuit.breaker_snapshot";

export async function emitTradeEvent(args: {
  userId: string;
  entityType: "draft" | "trade";
  entityId: string;
  eventType: TradeEventType;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createServiceSupabase();
  const { error } = await supabase.from("trade_events").insert({
    user_id: args.userId,
    entity_type: args.entityType,
    entity_id: args.entityId,
    event_type: args.eventType,
    payload: (args.payload ?? {}) as Json,
  });
  if (error) throw new Error(`emitTradeEvent failed [${args.eventType}]: ${error.message}`);
}
