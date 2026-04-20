"use client";

export default function AuthError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="surface-panel w-full max-w-md p-7 text-center">
        <p className="meta-label">Authentication Error</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-tds-text">Unable to load this authentication page.</h1>
        <p className="mt-3 text-sm leading-6 text-tds-dim">Retry to recover the auth flow and restore access to login or sign-up.</p>
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
