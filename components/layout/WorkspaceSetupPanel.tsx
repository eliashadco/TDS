import Link from "next/link";

type WorkspaceSetupPanelProps = {
  kicker: string;
  title: string;
  description: string;
  hint: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export default function WorkspaceSetupPanel({
  kicker,
  title,
  description,
  hint,
  ctaHref,
  ctaLabel,
}: WorkspaceSetupPanelProps) {
  return (
    <main className="settings-terminal">
      <div className="page-header">
        <div>
          <p className="meta-label">{kicker}</p>
          <h2>{title}</h2>
          <p className="page-intro max-w-3xl">{description}</p>
        </div>
      </div>

      <section className="settings-grid">
        <section className="surface-panel">
          <div className="surface-header">
            <div>
              <p className="meta-label">Workspace State</p>
              <h3>Action required before this route can render</h3>
            </div>
            <span className="tag">Setup Gate</span>
          </div>

          <div className="priority-stack mt-5">
            <article className="priority-card calm">
              <strong>Why this route is blocked</strong>
              <p>{description}</p>
            </article>
            <article className="priority-card calm">
              <strong>What to do next</strong>
              <p>{hint}</p>
            </article>
          </div>

          {ctaHref && ctaLabel ? (
            <div className="mt-6">
              <Link href={ctaHref} className="primary-button">
                {ctaLabel}
              </Link>
            </div>
          ) : null}
        </section>

        <aside className="surface-panel settings-side-panel">
          <p className="meta-label">Operator Note</p>
          <div className="priority-stack">
            <article className="priority-card warn">
              <strong>System-first gating is intentional</strong>
              <p>The balanced-guided workspace only opens operational routes once the required mode, strategy, or schema context exists.</p>
            </article>
            <article className="priority-card calm">
              <strong>Safe to resume after setup</strong>
              <p>Once the missing requirement is satisfied, reload or revisit this route and the normal page surface will render in-place.</p>
            </article>
          </div>
        </aside>
      </section>
    </main>
  );
}