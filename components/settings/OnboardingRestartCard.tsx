"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, RotateCcw } from "lucide-react";

const STORAGE_KEY = "tds-landing-walkthrough-dismissed";

export default function OnboardingRestartCard() {
  const router = useRouter();

  return (
    <section className="fin-panel p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="fin-kicker">Onboarding Tutorial</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Restart the guided product walkthrough.</h2>
          <p className="mt-4 text-sm leading-7 text-tds-dim">
            Reopen the original onboarding flow from the landing page to revisit platform structure, mode selection, idea flow, execution, and review.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            window.localStorage.removeItem(STORAGE_KEY);
            router.push("/?walkthrough=1");
          }}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-tds-slate px-4 text-sm font-semibold text-white shadow-[0_20px_45px_-24px_rgba(13,21,40,0.7)] hover:-translate-y-0.5 hover:bg-[#162649]"
        >
          <RotateCcw className="h-4 w-4" />
          Restart tutorial
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}