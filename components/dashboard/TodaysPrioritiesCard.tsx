"use client";

import { useEffect, useState } from "react";

type PriorityTone = "info" | "success" | "warning" | "alert";

export type DashboardPriority = {
  id: string;
  title: string;
  detail: string;
  tone: PriorityTone;
};

type TodaysPrioritiesCardProps = {
  items: DashboardPriority[];
};

const STORAGE_KEY = "ii-dashboard-priorities-dismissed";

function toneClasses(tone: PriorityTone): string {
  if (tone === "success") {
    return "bg-emerald-400";
  }
  if (tone === "warning") {
    return "bg-amber-300";
  }
  if (tone === "alert") {
    return "bg-rose-400";
  }
  return "bg-sky-300";
}

export default function TodaysPrioritiesCard({ items }: TodaysPrioritiesCardProps) {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCheckedIds(JSON.parse(stored) as string[]);
      }
    } catch {
      setCheckedIds([]);
    }
  }, []);

  function toggleItem(id: string) {
    setCheckedIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <section className="rounded-[32px] bg-tds-slate p-6 text-white shadow-[0_28px_70px_-38px_rgba(13,21,40,0.72)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/58">Today&apos;s Priorities</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Automatic reminders and checks</h2>
      <p className="mt-3 text-sm leading-6 text-white/70">Surface rebalancing risk, target events, and review debt before they turn into missed execution work.</p>

      <div className="mt-6 space-y-4">
        {items.length === 0 ? <p className="text-sm text-white/70">No urgent reminders right now. Review the smart watchlist and keep risk capacity available.</p> : null}
        {items.map((item) => {
          const checked = checkedIds.includes(item.id);

          return (
            <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-[24px] border px-4 py-4 ${checked ? "border-white/12 bg-white/6 opacity-60" : "border-white/10 bg-white/8"}`}>
              <input type="checkbox" checked={checked} onChange={() => toggleItem(item.id)} className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent text-emerald-400 focus:ring-emerald-300" />
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${toneClasses(item.tone)}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">{item.title}</span>
                <span className="mt-1 block text-sm leading-6 text-white/68">{item.detail}</span>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}