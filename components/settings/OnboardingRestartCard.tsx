"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, RotateCcw } from "lucide-react";

const STORAGE_KEY = "tds-landing-walkthrough-dismissed";

export default function OnboardingRestartCard() {
  const router = useRouter();

  return (
    <section className="surface-panel settings-side-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="meta-label">Onboarding Tutorial</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">Restart the guided product walkthrough.</h3>
          <p className="mt-3 text-sm leading-7 text-tds-dim">
            Reopen the original onboarding flow from the landing page to revisit platform structure, mode selection, idea flow, execution, and review.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            window.localStorage.removeItem(STORAGE_KEY);
            router.push("/?walkthrough=1");
          }}
          className="secondary-button"
        >
          <RotateCcw className="h-4 w-4" />
          Restart tutorial
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}