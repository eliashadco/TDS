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
    <main className="space-y-6">
      <section className="fin-panel p-6 sm:p-8">
        <p className="fin-kicker">{kicker}</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-[-0.05em] text-tds-text">{title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-tds-dim">{description}</p>

        <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-slate-50/75 p-5">
          <p className="text-sm leading-7 text-tds-text">{hint}</p>
        </div>

        {ctaHref && ctaLabel ? (
          <div className="mt-6">
            <Link
              href={ctaHref}
              className="inline-flex h-11 items-center rounded-2xl bg-tds-slate px-4 text-sm font-semibold text-white shadow-[0_20px_45px_-24px_rgba(13,21,40,0.7)] hover:-translate-y-0.5 hover:bg-[#162649]"
            >
              {ctaLabel}
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}