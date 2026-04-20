"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { generateNudges, computeExperience } from "@/lib/trading/progressive";
import type { AmbientNudge, ExperienceStatus } from "@/lib/trading/progressive";

type AmbientNudgesProps = {
  userId: string;
};

const NUDGE_ICON: Record<string, React.ReactNode> = {
  info: <Info className="h-3.5 w-3.5" />,
  warning: <AlertTriangle className="h-3.5 w-3.5" />,
  success: <CheckCircle className="h-3.5 w-3.5" />,
};

export default function AmbientNudges({ userId }: AmbientNudgesProps) {
  const [nudges, setNudges] = useState<AmbientNudge[]>([]);
  const [experience, setExperience] = useState<ExperienceStatus | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      // Fetch trade stats
      const { data: trades } = await supabase
        .from("trades")
        .select("state, classification, entry_price, exit_price, direction")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!trades) return;

      const closedTrades = trades.filter((t) => t.state === "closed");
      const tradeCount = closedTrades.length;
      const overrideCount = closedTrades.filter(
        (t) => t.classification === "override" || t.classification === "out_of_bounds",
      ).length;
      const inPolicyCount = closedTrades.filter((t) => t.classification === "in_policy").length;

      // Count consecutive losses from most recent
      let consecutiveLosses = 0;
      for (const t of closedTrades) {
        if (t.entry_price == null || t.exit_price == null) continue;
        const pnl = t.direction === "LONG"
          ? t.exit_price - t.entry_price
          : t.entry_price - t.exit_price;
        if (pnl < 0) {
          consecutiveLosses++;
        } else {
          break;
        }
      }

      // Fetch discipline score
      let disciplineScore: number | null = null;
      try {
        const res = await fetch("/api/discipline");
        if (res.ok) {
          const d = await res.json();
          if (typeof d.score === "number") disciplineScore = d.score;
        }
      } catch {}

      // Check circuit breaker
      let circuitBreakerTripped = false;
      try {
        const res = await fetch("/api/circuit-breaker");
        if (res.ok) {
          const cb = await res.json();
          circuitBreakerTripped = cb.tripped === true;
        }
      } catch {}

      const exp = computeExperience(tradeCount);
      setExperience(exp);

      const generatedNudges = generateNudges({
        tradeCount,
        overrideCount,
        inPolicyCount,
        consecutiveLosses,
        disciplineScore,
        circuitBreakerTripped,
      });

      setNudges(generatedNudges);
    }

    void load();
  }, [userId, supabase]);

  if (nudges.length === 0 && !experience) return null;

  return (
    <article className="ambient-nudges-card trade-rail-card">
      <p className="meta-label">Ambient Intelligence</p>

      {experience && (
        <div className="ambient-experience">
          <div className="ambient-tier" data-tier={experience.tier}>
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{experience.tier.charAt(0).toUpperCase() + experience.tier.slice(1)}</span>
          </div>
          {experience.nextTier && (
            <p className="ambient-progress">
              {experience.tradesUntilNext} trade{experience.tradesUntilNext !== 1 ? "s" : ""} to{" "}
              {experience.nextTier}
            </p>
          )}
        </div>
      )}

      {nudges.length > 0 && (
        <div className="ambient-nudge-list">
          {nudges.map((n) => (
            <div key={n.id} className="ambient-nudge" data-type={n.type}>
              {NUDGE_ICON[n.type]}
              <p>{n.message}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
