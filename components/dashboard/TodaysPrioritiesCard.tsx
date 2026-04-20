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
  const criticalCount = items.filter((item) => item.tone === "alert" || item.tone === "warning").length;

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
    <aside className="surface-panel queue-panel">
      <div className="surface-header">
        <div>
          <p className="meta-label">Priority Queue</p>
          <h3>Action required</h3>
        </div>
        <span className="tag">{criticalCount} Critical</span>
      </div>

      <div className="priority-stack mt-4">
        {items.length === 0 ? (
          <article className="priority-card calm">
            <p className="meta-label">Workflow</p>
            <strong>No urgent workflow debt</strong>
            <p>Risk is controlled. Review the ready board before expanding into fresh scans.</p>
          </article>
        ) : null}
        {items.map((item) => {
          const checked = checkedIds.includes(item.id);
          const toneClass = item.tone === "alert" || item.tone === "warning" ? "warn" : "calm";

          return (
            <label key={item.id} className={`priority-card ${toneClass} flex cursor-pointer items-start gap-3 ${checked ? "opacity-60" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleItem(item.id)}
                className="mt-1 h-4 w-4 rounded border-[rgba(197,210,224,0.84)] bg-transparent text-[#247457] focus:ring-[#b8d7c8]"
              />
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${toneClasses(item.tone)}`} />
              <span className="min-w-0 flex-1">
                <span className="meta-label">{item.tone === "alert" || item.tone === "warning" ? "Target Review" : "Workflow"}</span>
                <strong className="mt-2 block">{item.title}</strong>
                <span className="mt-2 block text-sm leading-6 text-[#4e6273]">{item.detail}</span>
              </span>
            </label>
          );
        })}
      </div>
    </aside>
  );
}