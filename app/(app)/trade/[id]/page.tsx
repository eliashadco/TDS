import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";
import { ensureStrategyWorkspaceForAllModes } from "@/lib/trading/strategies";
import TradeDetailClient from "@/components/trade/TradeDetailClient";

export default async function TradeDetailPage({ params }: { params: { id: string } }) {
  const { userId, profile } = await getProtectedAppContext();
  const supabase = await createServerSupabase();

  const { data: trade } = await supabase
    .from("trades")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!trade) {
    notFound();
  }

  const metricQuery = supabase
    .from("user_metrics")
    .select("metric_id, metric_type, name, description")
    .eq("user_id", userId)
    .eq("mode", trade.mode);

  if (trade.strategy_id) {
    metricQuery.eq("strategy_id", trade.strategy_id);
  }

  const [{ data: metricRows }, { data: activeRows }, { strategies: availableStrategies }] = await Promise.all([
    metricQuery,
    supabase
      .from("trades")
      .select("id, risk_pct")
      .eq("user_id", userId)
      .eq("confirmed", true)
      .eq("closed", false),
    ensureStrategyWorkspaceForAllModes(supabase, userId),
  ]);

  const metricMap = (metricRows ?? []).reduce(
    (acc, row) => {
      acc[row.metric_id] = {
        name: row.name,
        description: row.description,
        type: row.metric_type,
      };
      return acc;
    },
    {} as Record<string, { name: string; description: string | null; type: "fundamental" | "technical" }>,
  );

  const portfolioHeat = (activeRows ?? []).reduce((sum, row) => sum + (Number(row.risk_pct ?? 0) * 100), 0);

  return (
    <TradeDetailClient
      trade={trade}
      metricMap={metricMap}
      availableStrategies={availableStrategies}
      portfolioContext={{
        equity: profile.equity,
        portfolioHeat,
        activeTradeCount: activeRows?.length ?? 0,
      }}
    />
  );
}