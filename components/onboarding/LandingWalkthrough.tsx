"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, CirclePlay, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tds-landing-walkthrough-dismissed";

const TOUR_STEPS = [
  {
    label: "Access",
    feature: "Landing + Auth",
    title: "Start with account access and a clean entry point.",
    description:
      "New users begin from the landing page, then move into sign up or sign in before entering the Intelligent Investors operating shell.",
    details: [
      "Use Create account to register and Sign in if you already have credentials.",
      "The redesign keeps this first decision simple so users are not dropped into dense controls immediately.",
      "This walkthrough is optional. Skip it any time and reopen it from the landing page.",
    ],
    outcome: "You enter the product with context instead of guessing where to start.",
  },
  {
    label: "Mode",
    feature: "Mode Selector",
    title: "Choose the trading mode before any workflow begins.",
    description:
      "The Intelligent Trading System uses the selected mode to shape cadence, chart context, metric defaults, and the operating posture shown across the app.",
    details: [
      "Select Investment for longer horizons, Swing for multi-day setups, Day Trade for intraday flow, or Scalp for tactical execution.",
      "If a user is unsure, they can start with Swing and adjust later from the shell.",
      "Mode selection is the first hard gate because the rest of the platform is mode-aware.",
    ],
    outcome: "The platform adapts its workflow to the trader instead of forcing one generic process.",
  },
  {
    label: "Dashboard",
    feature: "Portfolio Control",
    title: "Use the dashboard as the starting screen for every session.",
    description:
      "The dashboard surfaces equity, portfolio heat, active positions, watchlist names, and recent closed trades before anything else.",
    details: [
      "Read equity and heat first to understand capacity before adding risk.",
      "Check the operating stance rail to see whether the right move is sourcing ideas or managing open exposure.",
      "Use the active, watchlist, and recent closed panels as the daily review queue.",
    ],
    outcome: "Users start from portfolio state and risk limits, not from impulse trades.",
  },
  {
    label: "Idea Flow",
    feature: "MarketWatch + Thesis",
    title: "Source ideas through MarketWatch or by writing a thesis manually.",
    description:
      "There are two deliberate ways into the system: scan live movers in MarketWatch or start a thesis-driven trade from scratch.",
    details: [
      "MarketWatch helps qualify movers and stage opportunities into the watchlist.",
      "New thesis is for discretionary conviction when the trader already has a setup in mind.",
      "Both paths converge into the same scoring, sizing, and confirmation flow.",
    ],
    outcome: "Discovery stays structured whether ideas come from a scanner or from discretionary research.",
  },
  {
    label: "Execution",
    feature: "4-Step Trade Workflow",
    title: "Run every trade through thesis, assessment, sizing, and confirm.",
    description:
      "The core trade workflow is a gated sequence designed to force clarity before capital is committed.",
    details: [
      "Step 1 records ticker, direction, setup, thesis, catalyst window, and invalidation.",
      "Step 2 runs the AI assessment against enabled metrics with direction-aware scoring and contradiction checks.",
      "Step 3 calculates conviction-based sizing, then Step 4 confirms and deploys the trade.",
    ],
    outcome: "Execution decisions stay tied to evidence, position sizing, and explicit invalidation logic.",
  },
  {
    label: "Review",
    feature: "Trade Detail + Analytics + Settings",
    title: "Manage the position, journal the outcome, then close the loop with review.",
    description:
      "Once a trade is live, the platform shifts from entry logic to management, journaling, and system review.",
    details: [
      "Use the trade drawer to jump between positions and the trade detail view to mark tranches, close trades, and maintain journals.",
      "Analytics turns closed trades into expectancy, setup breakdown, and cumulative R review.",
      "Settings lets users tune metrics and Learn Mode without breaking the core process.",
    ],
    outcome: "The workflow ends with review and refinement, not just with the trade being closed.",
  },
] as const;

function markDismissed() {
  window.localStorage.setItem(STORAGE_KEY, "1");
}

export default function LandingWalkthrough() {
  const searchParams = useSearchParams();
  const [isReady, setIsReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const shouldForceOpen = searchParams.get("walkthrough") === "1";

  useEffect(() => {
    setIsReady(true);
    if (shouldForceOpen || window.localStorage.getItem(STORAGE_KEY) !== "1") {
      setActiveStep(0);
      setIsOpen(true);
    }
  }, [shouldForceOpen]);

  const step = TOUR_STEPS[activeStep];
  const isLastStep = activeStep === TOUR_STEPS.length - 1;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setActiveStep(0);
            setIsOpen(true);
          }}
          className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/16"
        >
          <CirclePlay className="h-4 w-4" />
          New user walkthrough
        </button>
        <p className="text-xs uppercase tracking-[0.18em] text-white/56">Optional tour. Skip anytime.</p>
      </div>

      {isReady && isOpen ? (
        <div className="fixed inset-0 z-[90] bg-slate-950/42 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-6">
          <div className="mx-auto grid h-full max-w-6xl gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
            <aside className="surface-panel overflow-y-auto px-4 py-5 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="meta-label">Guided Setup</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-tds-text">New user tour</h2>
                  <p className="mt-3 text-sm leading-6 text-tds-dim">A step-by-step preview of how the platform works from first access to post-trade review.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    markDismissed();
                    setIsOpen(false);
                  }}
                  aria-label="Skip walkthrough"
                  title="Skip walkthrough"
                  className="rounded-2xl border border-white/75 bg-white/80 p-2 text-tds-dim shadow-sm hover:bg-white hover:text-tds-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 space-y-2">
                {TOUR_STEPS.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setActiveStep(index)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[22px] border px-3 py-3 text-left transition",
                      index === activeStep
                        ? "border-blue-200 bg-blue-50 text-tds-blue shadow-[0_18px_35px_-28px_rgba(37,99,235,0.4)]"
                        : "border-white/70 bg-white/72 text-tds-dim hover:bg-white",
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-tds-text shadow-sm">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em]">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-tds-text">{item.feature}</p>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="surface-panel flex min-h-0 flex-col overflow-y-auto p-6 sm:p-7 lg:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="meta-label">Step {activeStep + 1} of {TOUR_STEPS.length}</p>
                <button
                  type="button"
                  onClick={() => {
                    markDismissed();
                    setIsOpen(false);
                  }}
                  className="rounded-full border border-white/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-tds-dim shadow-sm hover:bg-white hover:text-tds-text"
                >
                  Skip Tour
                </button>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_280px]">
                <div>
                  <p className="inline-tag neutral">{step.feature}</p>
                  <h3 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.05em] text-tds-text sm:text-4xl">{step.title}</h3>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-tds-dim sm:text-base">{step.description}</p>

                  <div className="mt-6 space-y-3">
                    {step.details.map((detail) => (
                      <div key={detail} className="trade-review-card flex items-start gap-3 p-4">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-tds-teal" />
                        <p className="text-sm leading-6 text-tds-text">{detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="trade-review-card h-fit p-5">
                  <p className="meta-label">Operator Outcome</p>
                  <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-tds-text">{step.outcome}</p>
                  <div className="mt-5 rounded-[20px] border border-dashed border-tds-border bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-tds-dim">Suggested Path</p>
                    <p className="mt-2 text-sm leading-6 text-tds-text">Create access, select mode, read the dashboard, source an idea, execute the 4-step trade flow, then manage and review the outcome.</p>
                  </div>
                </aside>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/70 pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep((current) => Math.max(0, current - 1))}
                    disabled={activeStep === 0}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/80 bg-white px-4 text-sm font-semibold text-tds-text shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isLastStep) {
                        markDismissed();
                        setIsOpen(false);
                        setActiveStep(0);
                        return;
                      }
                      setActiveStep((current) => current + 1);
                    }}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-tds-slate px-4 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(13,21,40,0.7)] hover:-translate-y-0.5 hover:bg-[#162649]"
                  >
                    {isLastStep ? "Finish walkthrough" : "Next step"}
                    {!isLastStep ? <ChevronRight className="h-4 w-4" /> : null}
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/login"
                    onClick={markDismissed}
                    className="inline-flex h-11 items-center rounded-2xl border border-white/80 bg-white px-4 text-sm font-semibold text-tds-text shadow-sm hover:bg-tds-wash"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={markDismissed}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-tds-blue px-4 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 hover:bg-blue-600"
                  >
                    Create account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}