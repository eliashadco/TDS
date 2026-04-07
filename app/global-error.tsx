"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-tds-bg text-tds-text">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="fin-panel w-full p-8">
            <p className="fin-kicker">Fatal Error</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">Something went wrong</h1>
            <p className="mt-3 text-sm leading-6 text-tds-dim">A fatal error occurred while rendering this page.</p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-5 rounded-2xl bg-tds-slate px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_42px_-24px_rgba(13,21,40,0.7)] hover:-translate-y-0.5 hover:bg-[#162649]"
            >
              Retry
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
