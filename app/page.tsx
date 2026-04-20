import Link from "next/link";
import LandingWalkthrough from "@/components/onboarding/LandingWalkthrough";

export default function Home() {
  const proofCards = [
    { label: "Focus", value: "Risk before noise" },
    { label: "Cadence", value: "Mode-aware workflows" },
    { label: "Output", value: "Cleaner execution logs" },
  ];

  const summaryCards = [
    {
      kicker: "What Changed",
      title: "The interface now behaves like an investor platform, not a scaffold.",
      body: [
        "Breathable spacing replaces dense panel stacking.",
        "Shared paper surfaces and restrained contrast improve focus.",
        "Risk, conviction, and next action now read as primary signals.",
      ],
    },
    {
      kicker: "Portfolio Language",
      metric: "$100K",
      body: ["Sharper typography and calmer numeric hierarchy."],
    },
    {
      kicker: "Decision Surface",
      metric: "4 steps",
      body: ["A clearer path through thesis, assessment, sizing, and confirm."],
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center gap-6 px-6 py-10 sm:px-10 lg:py-14 xl:px-12">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.22fr)_minmax(340px,0.78fr)] xl:gap-8">
        <div className="fin-hero px-7 py-8 sm:px-10 sm:py-10 xl:px-12 xl:py-12">
          <p className="fin-chip fin-chip-strong">Intelligent Investors</p>
          <h1 className="font-display mt-6 max-w-3xl text-[3.15rem] font-semibold leading-[0.92] text-white sm:text-[4rem] lg:text-[4.7rem] xl:text-[5.25rem]">
            Intelligent Trading System, rebuilt as a calmer operating surface for Intelligent Investors.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/76">
            Move from cluttered trader-terminal visuals to a cleaner decision flow built around risk, conviction, and execution clarity.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="inline-flex h-12 items-center rounded-2xl bg-white px-5 text-sm font-semibold text-tds-slate shadow-[0_20px_44px_-28px_rgba(42,31,24,0.45)] hover:-translate-y-0.5">
              Sign in
            </Link>
            <Link href="/signup" className="inline-flex h-12 items-center rounded-2xl border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/16">
              Create account
            </Link>
          </div>
          <LandingWalkthrough />
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {proofCards.map((card) => (
              <div key={card.label} className="auth-spotlight-card">
                <p className="text-xs uppercase tracking-[0.18em] text-white/58">{card.label}</p>
                <p className="mt-2 text-lg font-semibold text-white">{card.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="fin-panel p-6 xl:p-7">
            <p className="fin-kicker">{summaryCards[0].kicker}</p>
            <h2 className="font-display mt-3 text-[2.1rem] font-semibold leading-[0.95] text-tds-text xl:text-[2.45rem]">{summaryCards[0].title}</h2>
            <div className="mt-5 space-y-4 text-sm leading-6 text-tds-dim">
              {summaryCards[0].body.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            {summaryCards.slice(1).map((card) => (
              <div key={card.kicker} className="fin-card p-5">
                <p className="fin-kicker">{card.kicker}</p>
                <p className="font-display mt-3 text-[2.7rem] font-semibold leading-none text-tds-text">{card.metric}</p>
                <p className="mt-2 text-sm text-tds-dim">{card.body[0]}</p>
              </div>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
