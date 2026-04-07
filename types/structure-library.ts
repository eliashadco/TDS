export type TradeStructureItemType = "setup_type" | "condition" | "chart_pattern";

export type TradeStructureLibraryItem = {
  id: string;
  userId: string;
  itemType: TradeStructureItemType;
  label: string;
  family: string;
  detail: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
};