"use client";

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

function toneLabel(tone: PriorityTone): string {
  if (tone === "alert") {
    return "Risk alert";
  }
  if (tone === "warning") {
    return "Action now";
  }
  if (tone === "success") {
    return "Momentum";
  }
  return "Workflow";
}

/** Act Now rail — items come from the server summary only (PR 6 — no client dismiss / local pipeline state). */
export default function TodaysPrioritiesCard({ items }: TodaysPrioritiesCardProps) {
  const criticalCount = items.filter((item) => item.tone === "alert" || item.tone === "warning").length;

  return (
    <aside className="surface-panel queue-panel">
      <div className="surface-header">
        <div>
          <p className="meta-label">Monitoring Rail</p>
          <h3>Act Now</h3>
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
          const toneClass = item.tone === "alert" || item.tone === "warning" ? "warn" : "calm";

          return (
            <article key={item.id} className={`priority-card ${toneClass} flex items-start gap-3`}>
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${toneClasses(item.tone)}`} />
              <span className="min-w-0 flex-1">
                <span className="meta-label">{toneLabel(item.tone)}</span>
                <strong className="mt-2 block">{item.title}</strong>
                <span className="mt-2 block text-sm leading-6 text-[#4e6273]">{item.detail}</span>
              </span>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
