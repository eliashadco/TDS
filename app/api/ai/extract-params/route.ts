import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { createAIJsonCompletion, resolveAIProviderConfig, aiErrorResponse } from "@/lib/ai/provider";
import { buildExtractParamsPrompt } from "@/lib/ai/prompts";
import { emitTradeEvent } from "@/lib/trading/events";
import { patchDraftMetadata } from "@/lib/trading/drafts";
import type { DraftIntakeField, ExtractParamsResponse } from "@/types/draft";
import type { Json } from "@/types/database";

// Canon §8.4 source whitelist is enforced at the evidence record layer (P4 trade-evidence-updater
// and trade_evidence_records inserts). Field-level evidenceIds are record UUIDs — the source
// name check happens when those records are created, not here.

// ---------------------------------------------------------------------------
// Zod schema for AI output validation (Hard Rule 5 — server enforces candidate state)
// ---------------------------------------------------------------------------
const IntakeFieldSchema = z.object({
  id: z.string().min(1),
  parameterDefinitionId: z.string().nullable().default(null),
  name: z.string().min(1),
  scope: z.enum(["context", "contract", "risk", "execution"]),
  operationalClass: z.enum(["informational", "required_for_deploy", "required_for_monitoring"]),
  provenance: z.enum(["ai_extract", "ai_suggest"]),
  resolutionState: z.enum(["candidate_extracted", "candidate_suggested"]),
  challengeState: z.literal("not_checked").default("not_checked"),
  value: z.unknown().nullable().default(null),
  candidateValues: z.array(z.unknown()).optional().default([]),
  evidenceIds: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
});

const RequestSchema = z.object({
  draftId: z.string().uuid(),
  freeText: z.string().min(1).max(5000),
  ticker: z.string().min(1).max(12),
  direction: z.enum(["LONG", "SHORT"]),
  strategyId: z.string().uuid().nullable().optional(),
});

/* ---------- POST /api/ai/extract-params ----------
 * V4 replacement for the legacy /api/ai/assess route.
 * Extracts DraftIntakeField candidates from free-text trader input.
 * HARD RULE 5: no field may leave this route with resolutionState = 'user_confirmed'.
 * Canon §8.3 / types/draft.ts ExtractParamsResponse.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body", path: [] } },
      { status: 400 },
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: first.message, path: first.path } },
      { status: 400 },
    );
  }

  const { draftId, freeText, ticker, direction, strategyId } = parsed.data;

  // Verify draft ownership (404 on miss — do not leak existence)
  const { data: draft } = await supabase
    .from("trade_drafts")
    .select("id")
    .eq("id", draftId)
    .eq("user_id", user.id)
    .single();

  if (!draft) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Draft not found" } },
      { status: 404 },
    );
  }

  // Load strategy parameter definitions for richer extraction context
  const serviceClient = createServiceSupabase();
  let paramDefs: Array<{
    id: string;
    name: string;
    type: string;
    scope: string;
    operational_class: string;
  }> = [];

  if (strategyId) {
    const { data: defs } = await serviceClient
      .from("strategy_parameter_definitions")
      .select("id, name, type, scope, operational_class")
      .eq("strategy_id", strategyId);
    if (defs) paramDefs = defs;
  }

  // Resolve provider config before calling AI (for logging on failure)
  let providerConfig: { provider: string; model: string };
  try {
    providerConfig = resolveAIProviderConfig();
  } catch (err) {
    return aiErrorResponse(err);
  }

  // Call AI
  const prompt = buildExtractParamsPrompt({
    ticker,
    direction,
    freeText,
    strategyId,
    parameterDefinitions: paramDefs,
  });

  let aiText: string;
  try {
    const result = await createAIJsonCompletion({
      prompt,
      system:
        "You are a structured trade parameter extractor. Return only a JSON array of DraftIntakeField objects. Never return user_confirmed resolution state.",
      maxTokens: 1500,
    });
    aiText = result.text;
  } catch (err) {
    console.error("[extract-params] AI call failed", {
      provider: providerConfig.provider,
      model: providerConfig.model,
    });
    return aiErrorResponse(err);
  }

  // Strip markdown fences if the model wrapped the JSON
  const cleaned = aiText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Parse the raw array
  let rawFields: unknown[];
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("AI response is not an array");
    rawFields = parsed;
  } catch (parseErr) {
    console.error("[extract-params] AI_PARSE_FAILURE", {
      provider: providerConfig.provider,
      model: providerConfig.model,
      parseError: String(parseErr),
      rawText: aiText.slice(0, 500),
    });
    return NextResponse.json(
      {
        error: {
          code: "AI_PARSE_FAILURE",
          message: "AI response could not be parsed as a field array",
          provider: providerConfig.provider,
          model: providerConfig.model,
        },
      },
      { status: 502 },
    );
  }

  // Validate each field with Zod; drop invalid entries and log
  const validFields: DraftIntakeField[] = [];
  for (const raw of rawFields) {
    const fieldResult = IntakeFieldSchema.safeParse(raw);
    if (!fieldResult.success) {
      console.warn("[extract-params] dropping invalid field from AI", {
        provider: providerConfig.provider,
        model: providerConfig.model,
        issues: fieldResult.error.issues,
        rawField: raw,
      });
      continue;
    }

    // HARD RULE 5 — server forces candidate state regardless of what AI returned
    const field = fieldResult.data as DraftIntakeField;
    if (
      field.resolutionState !== "candidate_extracted" &&
      field.resolutionState !== "candidate_suggested"
    ) {
      field.resolutionState = field.provenance === "ai_extract"
        ? "candidate_extracted"
        : "candidate_suggested";
    }

    // Canon §8.4 source whitelist — drop any unsupported evidenceIds sources
    // (evidenceIds are string IDs; we can't whitelist IDs themselves, but we
    // enforce the source whitelist at the evidence record level in P4)
    validFields.push(field);
  }

  if (validFields.length === 0) {
    console.error("[extract-params] AI_PARSE_FAILURE — zero valid fields", {
      provider: providerConfig.provider,
      model: providerConfig.model,
    });
    return NextResponse.json(
      {
        error: {
          code: "AI_PARSE_FAILURE",
          message: "AI returned no extractable fields",
          provider: providerConfig.provider,
          model: providerConfig.model,
        },
      },
      { status: 502 },
    );
  }

  // Persist fields onto the draft (merges into intake_fields)
  try {
    await patchDraftMetadata(draftId, { intake_fields: validFields });
  } catch (persistErr) {
    console.error("[extract-params] persist failed", persistErr);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to persist extracted fields" } },
      { status: 500 },
    );
  }

  // Persist evidence records for any evidenceIds the AI provided
  // Source whitelist enforced: only allowed sources are written
  // (Full evidence record creation belongs to P4 — here we store IDs on fields only)

  // Emit draft.intake_extracted event
  await emitTradeEvent({
    userId: user.id,
    entityType: "draft",
    entityId: draftId,
    eventType: "draft.intake_extracted",
    payload: {
      provider: providerConfig.provider,
      model: providerConfig.model,
      fieldCount: validFields.length,
    },
  });

  const response: ExtractParamsResponse = {
    draftId,
    fields: validFields,
  };

  // Persist the full response as a structured record for audit (non-blocking)
  void serviceClient
    .from("trade_evidence_records")
    .insert({
      user_id: user.id,
      draft_id: draftId,
      provider: providerConfig.provider,
      source_label: "ai_extract_params",
      captured_at: new Date().toISOString(),
      normalized_payload: response as unknown as Json,
      silent_update: true,
    })
    .then(({ error }) => {
      if (error) console.warn("[extract-params] evidence record insert failed", error.message);
    });

  return NextResponse.json(response);
}
