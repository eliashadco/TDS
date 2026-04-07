"use client";

export default function AppSectionError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="p-4 md:p-6">
      <div className="fin-panel p-6">
        <p className="fin-kicker">Section Error</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-tds-text">This app section failed to load.</h1>
        <p className="mt-3 text-sm leading-6 text-tds-dim">Refresh the section to retry data loading and restore the current workspace.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 rounded-2xl bg-tds-slate px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_42px_-24px_rgba(13,21,40,0.7)] hover:-translate-y-0.5 hover:bg-[#162649]"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
