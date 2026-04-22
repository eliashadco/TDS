export type TradeStructureItemType = "setup_type" | "condition" | "chart_pattern";

export type TradeSetupCategory = "fundamental" | "technical";

export type TradeStructureLibraryItem = {
  id: string;
  userId: string;
  itemType: TradeStructureItemType;
  setupCategory: TradeSetupCategory | null;
  label: string;
  family: string;
  detail: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
};