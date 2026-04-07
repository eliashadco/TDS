"use client";

import Link from "next/link";
import { ArrowRight, Brain, Clock3, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReadyTradeView = {
  id: string;
  ticker: string;
  direction: "LONG" | "SHORT";
  verdict: "GO" | "CAUTION" | "SKIP";
  passRate: number;
  strategyLabel: string;
  strategyDetail: string;
  thesisSummary: string;
  triggerLevel: number | null;
  updatedAt: string | null;
  note: string;
};

type ReadyTradesCardProps = {
  items: ReadyTradeView[];
};

function DirectionBadge({ direction }: { direction: "LONG" | "SHORT" }) {
  return (
    <span className={cn(
      "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
      direction === "LONG" ? "bg-emerald-400/12 text-emerald-200" : "bg-rose-400/12 text-rose-200",
    )}>
      {direction}
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: ReadyTradeView["verdict"] }) {
  return (
    <span className={cn(
      "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
      verdict === "GO" ? "bg-emerald-400/14 text-emerald-200" : "bg-sky-400/14 text-sky-200",
    )}>
      {verdict === "GO" ? "Ready" : "Queue"}
    </span>
  );
}

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return "Not saved yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTrigger(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "Planner pending";
  }

  return value.toFixed(2);
}

export default function ReadyTradesCard({ items }: ReadyTradesCardProps) {
  const readyCount = items.filter((item) => item.verdict === "GO").length;
  const queuedCount = items.filter((item) => item.verdict === "CAUTION").length;

  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-950/90 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.24),_transparent_40%),linear-gradient(135deg,#0f172a,#101928_58%,#09111d)] p-6 text-white shadow-[0_34px_90px_-50px_rgba(15,23,42,0.92)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/56">AI Ready Board</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">Ready trades</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">High-fit names from your MarketWatch workbench.</p>
        </div>
        <Link href="/marketwatch" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/14 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/16">
          Open MarketWatch
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[22px] border border-white/10 bg-white/6 p-4 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.16em] text-white/56">Ready Now</p>
          <p className="mt-2 font-mono text-2xl text-white">{readyCount.toString().padStart(2, "0")}</p>
          <p className="mt-2 text-xs text-white/64">At GO in the workbench.</p>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/6 p-4 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.16em] text-white/56">Queued Next</p>
          <p className="mt-2 font-mono text-2xl text-white">{queuedCount.toString().padStart(2, "0")}</p>
          <p className="mt-2 text-xs text-white/64">Close to GO and worth monitoring.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-white/16 bg-white/5 px-5 py-5 text-sm leading-6 text-white/68">
          No ready names yet. Score ideas in MarketWatch to populate this board.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-white/10 bg-white/7 p-4 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-semibold text-white">{item.ticker}</span>
                    <DirectionBadge direction={item.direction} />
                    <VerdictBadge verdict={item.verdict} />
                    <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/72">
                      {Math.round(item.passRate * 100)}% fit
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{item.strategyLabel}</p>
                  <p className="mt-1 text-sm leading-6 text-white/68">{item.strategyDetail}</p>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/6 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/56">Trigger</p>
                  <p className="mt-2 font-mono text-lg text-white">{formatTrigger(item.triggerLevel)}</p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-white/74">{item.thesisSummary}</p>
              <p className="mt-2 text-sm leading-6 text-white/58">{item.note}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] border border-white/8 bg-black/10 px-3.5 py-3">
                  <div className="flex items-center gap-2 text-white/56">
                    <Brain className="h-4 w-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Score</span>
                  </div>
                  <p className="mt-2 text-sm text-white">{Math.round(item.passRate * 100)}% strategy fit</p>
                </div>
                <div className="rounded-[18px] border border-white/8 bg-black/10 px-3.5 py-3">
                  <div className="flex items-center gap-2 text-white/56">
                    <Target className="h-4 w-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Planner</span>
                  </div>
                  <p className="mt-2 text-sm text-white">{formatTrigger(item.triggerLevel)}</p>
                </div>
                <div className="rounded-[18px] border border-white/8 bg-black/10 px-3.5 py-3">
                  <div className="flex items-center gap-2 text-white/56">
                    <Clock3 className="h-4 w-4" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Saved</span>
                  </div>
                  <p className="mt-2 text-sm text-white">{formatUpdatedAt(item.updatedAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}