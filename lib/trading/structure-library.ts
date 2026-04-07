import type { SupabaseClient } from "@supabase/supabase-js";
import type { TradePresetOption } from "@/lib/trading/presets";
import type { Database } from "@/types/database";
import type { TradeStructureLibraryItem, TradeStructureItemType } from "@/types/structure-library";

type StructureLibraryRow = Database["public"]["Tables"]["user_trade_structure_items"]["Row"];

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function isMissingStructureLibrarySchemaError(error: unknown): boolean {
  const value = asRecord(error);
  const code = asString(value.code);
  const message = asString(value.message);

  return code === "PGRST205" && message.includes("public.user_trade_structure_items");
}

export function normalizeStructureLibraryRow(row: StructureLibraryRow): TradeStructureLibraryItem {
  return {
    id: row.id,
    userId: row.user_id,
    itemType: row.item_type,
    label: row.label,
    family: row.family,
    detail: row.detail,
    keywords: row.keywords ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildStructureLibraryInsert(
  userId: string,
  itemType: TradeStructureItemType,
  label: string,
  family = "Custom",
  detail = "",
  keywords: string[] = [],
): Database["public"]["Tables"]["user_trade_structure_items"]["Insert"] {
  return {
    user_id: userId,
    item_type: itemType,
    label: label.trim(),
    family: family.trim() || "Custom",
    detail: detail.trim(),
    keywords: keywords.map((keyword) => keyword.trim()).filter(Boolean),
  };
}

export function filterStructureLibraryItems(
  items: TradeStructureLibraryItem[],
  itemType: TradeStructureItemType,
): TradeStructureLibraryItem[] {
  return items.filter((item) => item.itemType === itemType);
}

export function mergeTradePresetOptions(params: {
  baseOptions: TradePresetOption[];
  sharedItems: TradeStructureLibraryItem[];
  itemType: TradeStructureItemType;
  selectedLabels?: string[];
}): TradePresetOption[] {
  const { baseOptions, sharedItems, itemType, selectedLabels = [] } = params;
  const byLabel = new Map<string, TradePresetOption>();

  for (const option of baseOptions) {
    byLabel.set(option.label.trim().toLowerCase(), option);
  }

  for (const item of sharedItems) {
    if (item.itemType !== itemType) {
      continue;
    }

    byLabel.set(item.label.trim().toLowerCase(), {
      label: item.label,
      family: item.family || "Custom",
      detail: item.detail || `Shared ${itemType.replace("_", " ")} entry.`,
      keywords: item.keywords,
    });
  }

  for (const label of selectedLabels) {
    const normalized = label.trim().toLowerCase();
    if (!normalized || byLabel.has(normalized)) {
      continue;
    }

    byLabel.set(normalized, {
      label,
      family: "Saved",
      detail: "Selected for this trade but not yet saved to the shared library.",
      keywords: [label],
    });
  }

  return Array.from(byLabel.values()).sort((left, right) => left.label.localeCompare(right.label));
}

export async function loadSharedTradeStructureLibrary(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<TradeStructureLibraryItem[]> {
  try {
    const { data, error } = await supabase
      .from("user_trade_structure_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map(normalizeStructureLibraryRow);
  } catch (error) {
    if (isMissingStructureLibrarySchemaError(error)) {
      return [];
    }

    throw error;
  }
}