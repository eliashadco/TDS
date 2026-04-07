import Link from "next/link";
import LandingWalkthrough from "@/components/onboarding/LandingWalkthrough";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-6 px-6 py-12 sm:px-10 lg:py-16">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="fin-hero px-7 py-8 sm:px-10 sm:py-10">
          <p className="fin-chip fin-chip-strong">Intelligent Investors</p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl lg:text-6xl">
            Intelligent Trading System, rebuilt as a calmer operating surface for Intelligent Investors.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/76">
            Move from cluttered trader-terminal visuals to a cleaner decision flow built around risk, conviction, and execution clarity.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="inline-flex h-12 items-center rounded-2xl bg-white px-5 text-sm font-semibold text-tds-slate shadow-[0_20px_44px_-28px_rgba(15,23,42,0.45)] hover:-translate-y-0.5">
              Sign in
            </Link>
            <Link href="/signup" className="inline-flex h-12 items-center rounded-2xl border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/16">
              Create account
            </Link>
          </div>
          <LandingWalkthrough />
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/14 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Focus</p>
              <p className="mt-2 text-lg font-semibold text-white">Risk before noise</p>
            </div>
            <div className="rounded-[24px] border border-white/14 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Cadence</p>
              <p className="mt-2 text-lg font-semibold text-white">Mode-aware workflows</p>
            </div>
            <div className="rounded-[24px] border border-white/14 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Output</p>
              <p className="mt-2 text-lg font-semibold text-white">Cleaner execution logs</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section className="fin-panel p-6">
            <p className="fin-kicker">What Changed</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">The interface now behaves like an investor platform, not a scaffold.</h2>
            <div className="mt-5 space-y-4 text-sm leading-6 text-tds-dim">
              <p>Breathable spacing replaces dense panel stacking.</p>
              <p>Shared white surfaces and restrained gradients improve resolution and focus.</p>
              <p>Risk, conviction, and next action are now treated as primary navigation signals.</p>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="fin-card p-5">
              <p className="fin-kicker">Portfolio Language</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-tds-text">$100K</p>
              <p className="mt-2 text-sm text-tds-dim">Sharper typography and calmer numeric hierarchy.</p>
            </div>
            <div className="fin-card p-5">
              <p className="fin-kicker">Decision Surface</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-tds-text">4 steps</p>
              <p className="mt-2 text-sm text-tds-dim">A more obvious path through thesis, assessment, sizing, and confirm.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
