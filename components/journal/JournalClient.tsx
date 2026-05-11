"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, BookOpen, ClipboardList, ShieldAlert, TrendingUp } from "lucide-react";
import type { Trade } from "@/types/trade";

/* ---------- types ---------- */

type Override = {
  id: string;
  trade_id: string;
  rules_broken: string[];
  justification: string;
  quality_flag: "valid" | "low_quality" | "high_risk";
  timer_duration_sec: number;
  created_at: string;
};

type DisciplineData = {
  score: number;
  summary: {
    totalTrades: number;
    inPolicyCount: number;
    overrideCount: number;
    inPolicyPnl: number;
    overridePnl: number;
    avgJustificationQuality: number;
    weekStart: string;
    weekEnd: string;
  };
};

type Tab = "trades" | "overrides" | "discipline";

type JournalClientProps = {
  trades: Trade[];
  overrides: Override[];
  tradesPendingReview?: Trade[];
};

/* ---------- helpers ---------- */

function isClosedTrade(t: Trade): boolean {
  return t.closed === true || t.state === "closed";
}

function computePnlPct(t: Trade): number | null {
  if (!t.entry_price || !t.exit_price) return null;
  const dir = t.direction === "SHORT" ? -1 : 1;
  return ((t.exit_price - t.entry_price) / t.entry_price) * 100 * dir;
}

function fmtPnl(v: number | null): string {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function classificationLabel(c: string | null | undefined): string {
  if (!c) return "—";
  switch (c) {
    case "in_policy": return "In Policy";
    case "override": return "Override";
    case "out_of_bounds": return "Out of Bounds";
    default: return c;
  }
}

function qualityLabel(q: string): string {
  switch (q) {
    case "valid": return "Valid";
    case "low_quality": return "Low Quality";
    case "high_risk": return "High Risk";
    default: return q;
  }
}

/* ---------- Post-trade review gate (PR 5 — Hard Rule 4) ---------- */

function TradeReviewGateForm({ trade, onSubmitted }: { trade: Trade; onSubmitted: () => void }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [executionAdherence, setExecutionAdherence] = useState<"clean" | "minor_deviation" | "major_deviation">("clean");
  const [deviationTag, setDeviationTag] = useState("");
  const [overridePresent, setOverridePresent] = useState(false);
  const [exitPriceRule, setExitPriceRule] = useState("");
  const [overrideRCostManual, setOverrideRCostManual] = useState("");
  const [lesson, setLesson] = useState("");
  const [outcomeR, setOutcomeR] = useState("");
  const [maeR, setMaeR] = useState("");
  const [mfeR, setMfeR] = useState("");
  const [holdingMinutes, setHoldingMinutes] = useState("");
  const [touched1r, setTouched1r] = useState(false);
  const [touched2r, setTouched2r] = useState(false);
  const [touched3r, setTouched3r] = useState(false);

  const exitPxNum = exitPriceRule.trim() === "" ? NaN : Number(exitPriceRule);
  const overrideCostNum = overrideRCostManual.trim() === "" ? NaN : Number(overrideRCostManual);

  const formComplete = useMemo(() => {
    const oR = Number(outcomeR);
    const mae = Number(maeR);
    const mfe = Number(mfeR);
    const hold = Number(holdingMinutes);
    if (!Number.isFinite(oR)) return false;
    if (!Number.isFinite(mae)) return false;
    if (!Number.isFinite(mfe)) return false;
    if (!Number.isFinite(hold) || hold < 0 || !Number.isInteger(hold)) return false;
    if (overridePresent) {
      const hasEst = Number.isFinite(exitPxNum);
      const hasManual = Number.isFinite(overrideCostNum);
      if (!hasEst && !hasManual) return false;
    }
    return true;
  }, [outcomeR, maeR, mfeR, holdingMinutes, overridePresent, exitPxNum, overrideCostNum]);

  async function submitReview() {
    if (!formComplete) return;
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      executionAdherence,
      overridePresent,
      outcomeR: Number(outcomeR),
      maeR: Number(maeR),
      mfeR: Number(mfeR),
      holdingMinutes: Number(holdingMinutes),
      touched1r,
      touched2r,
      touched3r,
    };
    if (deviationTag.trim()) body.deviationTag = deviationTag.trim();
    if (lesson.trim()) body.lesson = lesson.trim();
    if (overridePresent && Number.isFinite(exitPxNum)) {
      body.ruleBasedExitEstimate = { exit_price: exitPxNum };
    }
    if (overridePresent && !Number.isFinite(exitPxNum) && Number.isFinite(overrideCostNum)) {
      body.overrideRCost = overrideCostNum;
    }

    try {
      const res = await fetch(`/api/trades/${trade.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) {
        setError(json?.error?.message ?? `Submit failed (${res.status})`);
        return;
      }
      onSubmitted();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="journal-review-gate rounded-lg border border-slate-700/50 bg-slate-950/35 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-2 font-semibold text-tds-text">
          <ClipboardList className="h-4 w-4 shrink-0 text-amber-400" />
          {trade.ticker}
          <span className="text-xs font-normal uppercase tracking-wide text-tds-dim">review due</span>
        </span>
        <span className="text-xs text-tds-dim">{expanded ? "Hide" : "Open form"}</span>
      </button>
      {expanded ? (
        <div className="mt-4 grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-tds-dim">Execution adherence</span>
            <select
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-tds-text"
              value={executionAdherence}
              onChange={(e) =>
                setExecutionAdherence(e.target.value as "clean" | "minor_deviation" | "major_deviation")}
            >
              <option value="clean">Clean</option>
              <option value="minor_deviation">Minor deviation</option>
              <option value="major_deviation">Major deviation</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-tds-dim">Deviation tag (optional)</span>
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-tds-text"
              value={deviationTag}
              onChange={(e) => setDeviationTag(e.target.value)}
              placeholder="Short label"
            />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={overridePresent} onChange={(e) => setOverridePresent(e.target.checked)} />
            <span>Override present</span>
          </label>
          {overridePresent ? (
            <>
              <label className="grid gap-1">
                <span className="text-tds-dim">Rule-based exit price (for R ledger)</span>
                <input
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-tds-text"
                  value={exitPriceRule}
                  onChange={(e) => setExitPriceRule(e.target.value)}
                  placeholder="Required unless override R cost below"
                  inputMode="decimal"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-tds-dim">Override R cost (only if no exit price)</span>
                <input
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-tds-text"
                  value={overrideRCostManual}
                  onChange={(e) => setOverrideRCostManual(e.target.value)}
                  placeholder="Signed R vs rule path"
                  inputMode="decimal"
                />
              </label>
            </>
          ) : null}
          <label className="grid gap-1">
            <span className="text-tds-dim">Outcome (R)</span>
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-tds-text"
              value={outcomeR}
              onChange={(e) => setOutcomeR(e.target.value)}
              inputMode="decimal"
              required
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-tds-dim">MAE (R)</span>
              <input
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-tds-text"
                value={maeR}
                onChange={(e) => setMaeR(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-tds-dim">MFE (R)</span>
              <input
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-tds-text"
                value={mfeR}
                onChange={(e) => setMfeR(e.target.value)}
                inputMode="decimal"
              />
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-tds-dim">Holding minutes</span>
            <input
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-tds-text"
              value={holdingMinutes}
              onChange={(e) => setHoldingMinutes(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={touched1r} onChange={(e) => setTouched1r(e.target.checked)} />
              Touched 1R
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={touched2r} onChange={(e) => setTouched2r(e.target.checked)} />
              Touched 2R
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={touched3r} onChange={(e) => setTouched3r(e.target.checked)} />
              Touched 3R
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-tds-dim">Lesson (optional)</span>
            <textarea
              className="min-h-[72px] rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-tds-text"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="button"
            className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!formComplete || busy}
            onClick={() => void submitReview()}
          >
            {busy ? "Submitting…" : "Submit review"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- component ---------- */

export default function JournalClient({ trades, overrides, tradesPendingReview = [] }: JournalClientProps) {
  const [tab, setTab] = useState<Tab>("trades");
  const [discipline, setDiscipline] = useState<DisciplineData | null>(null);
  const [clearedReviewIds, setClearedReviewIds] = useState<Set<string>>(() => new Set());

  const router = useRouter();

  useEffect(() => {
    fetch("/api/discipline")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setDiscipline(d); })
      .catch(() => {});
  }, []);

  const pendingIds = useMemo(
    () => new Set(tradesPendingReview.map((t) => t.id).filter((id) => !clearedReviewIds.has(id))),
    [tradesPendingReview, clearedReviewIds],
  );

  const visiblePendingReviews = useMemo(
    () => tradesPendingReview.filter((t) => !clearedReviewIds.has(t.id)),
    [tradesPendingReview, clearedReviewIds],
  );

  /* ---------- derived data ---------- */

  const ruleGroups = useMemo(() => {
    const groups = new Map<string, { override: Override; trade: Trade }[]>();
    for (const o of overrides) {
      const trade = trades.find((t) => t.id === o.trade_id);
      if (!trade) continue;
      const rules = o.rules_broken.length > 0 ? o.rules_broken : ["unspecified"];
      for (const rule of rules) {
        if (!groups.has(rule)) groups.set(rule, []);
        groups.get(rule)!.push({ override: o, trade });
      }
    }
    return groups;
  }, [overrides, trades]);

  const closedTrades = trades.filter(isClosedTrade);
  const inPolicyTrades = closedTrades.filter((t) => t.classification === "in_policy");
  const overrideTradesClosed = closedTrades.filter(
    (t) => t.classification === "override" || t.classification === "out_of_bounds",
  );
  const inPolicyPnl = inPolicyTrades.reduce((s, t) => s + (computePnlPct(t) ?? 0), 0);
  const overridePnl = overrideTradesClosed.reduce((s, t) => s + (computePnlPct(t) ?? 0), 0);

  /* ---------- tabs ---------- */

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "trades", label: "All Trades", icon: <BookOpen className="h-4 w-4" /> },
    { key: "overrides", label: "Overrides", icon: <ShieldAlert className="h-4 w-4" /> },
    { key: "discipline", label: "Discipline", icon: <TrendingUp className="h-4 w-4" /> },
  ];

  return (
    <main className="journal-page">
      <header className="journal-header">
        <h1 className="journal-title">Trade Journal</h1>
        <p className="journal-subtitle">
          {closedTrades.length} closed trade{closedTrades.length !== 1 ? "s" : ""} &middot;{" "}
          {overrides.length} override{overrides.length !== 1 ? "s" : ""}
          {visiblePendingReviews.length > 0
            ? ` · ${visiblePendingReviews.length} review${visiblePendingReviews.length !== 1 ? "s" : ""} due`
            : null}
        </p>
      </header>

      {visiblePendingReviews.length > 0 ? (
        <section className="journal-panel mb-6">
          <h2 className="mb-3 text-lg font-semibold text-tds-text">Post-trade reviews</h2>
          <p className="mb-3 text-sm text-tds-dim">
            Complete the structured review to record outcomes and clear workflow tasks (single server write path).
          </p>
          <div className="flex flex-col gap-3">
            {visiblePendingReviews.map((t) => (
              <TradeReviewGateForm
                key={t.id}
                trade={t}
                onSubmitted={() => {
                  setClearedReviewIds((prev) => new Set(prev).add(t.id));
                  router.refresh();
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="journal-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`journal-tab ${tab === t.key ? "journal-tab-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "trades" && (
        <div className="journal-panel">
          {trades.length === 0 ? (
            <p className="journal-empty">No trades recorded yet.</p>
          ) : (
            <div className="journal-table-wrap">
              <table className="journal-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ticker</th>
                    <th>Direction</th>
                    <th>Strategy</th>
                    <th>PnL</th>
                    <th>Type</th>
                    <th>Review</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => {
                    const pnl = computePnlPct(t);
                    return (
                      <tr key={t.id}>
                        <td className="journal-cell-date">{fmtDate(t.created_at)}</td>
                        <td className="journal-cell-ticker">
                          {t.direction === "SHORT" ? (
                            <ArrowDownRight className="inline h-3.5 w-3.5 text-red-400" />
                          ) : (
                            <ArrowUpRight className="inline h-3.5 w-3.5 text-emerald-400" />
                          )}
                          {" "}{t.ticker}
                        </td>
                        <td>{t.direction ?? "—"}</td>
                        <td>{t.strategy_name ?? "—"}</td>
                        <td className={`journal-cell-pnl ${pnl !== null && pnl >= 0 ? "pnl-pos" : "pnl-neg"}`}>
                          {fmtPnl(pnl)}
                        </td>
                        <td>
                          <span
                            className="journal-badge"
                            data-classification={t.classification ?? "unknown"}
                          >
                            {classificationLabel(t.classification)}
                          </span>
                        </td>
                        <td>
                          {pendingIds.has(t.id) ? (
                            <span className="journal-badge" data-quality="high_risk">Due</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="journal-cell-state">{t.state}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "overrides" && (
        <div className="journal-panel">
          {overrides.length === 0 ? (
            <p className="journal-empty">No overrides recorded.</p>
          ) : (
            <div className="journal-override-groups">
              {Array.from(ruleGroups.entries()).map(([rule, items]) => (
                <div key={rule} className="journal-rule-group">
                  <h3 className="journal-rule-label">
                    <ShieldAlert className="inline h-4 w-4" /> {rule}
                    <span className="journal-rule-count">{items.length}</span>
                  </h3>
                  <div className="journal-table-wrap">
                    <table className="journal-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Ticker</th>
                          <th>Result</th>
                          <th>Quality</th>
                          <th>Justification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(({ override: o, trade: t }: { override: Override; trade: Trade }) => {
                          const pnl = computePnlPct(t);
                          return (
                            <tr key={o.id}>
                              <td className="journal-cell-date">{fmtDate(o.created_at)}</td>
                              <td className="journal-cell-ticker">{t.ticker}</td>
                              <td className={`journal-cell-pnl ${pnl !== null && pnl >= 0 ? "pnl-pos" : "pnl-neg"}`}>
                                {fmtPnl(pnl)}
                              </td>
                              <td>
                                <span
                                  className="journal-badge"
                                  data-quality={o.quality_flag}
                                >
                                  {qualityLabel(o.quality_flag)}
                                </span>
                              </td>
                              <td className="journal-cell-justification">
                                {o.justification.length > 80
                                  ? o.justification.slice(0, 80) + "…"
                                  : o.justification}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <div className="journal-review-prompt">
                <h3>Review Loop</h3>
                <p>After reviewing your overrides, consider:</p>
                <ul>
                  <li>Were any overrides correct in hindsight? Should the broken rule be softened?</li>
                  <li>Were override losses concentrated on specific rules? Should that rule be made hard?</li>
                  <li>Is your justification quality improving over time?</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "discipline" && (
        <div className="journal-panel">
          <div className="journal-discipline-grid">
            <div className="journal-discipline-card">
              <h3>Weekly Report</h3>
              <div className="journal-discipline-stats">
                <div className="journal-stat">
                  <span className="journal-stat-value">{discipline?.summary.totalTrades ?? closedTrades.length}</span>
                  <span className="journal-stat-label">Trades</span>
                </div>
                <div className="journal-stat">
                  <span className="journal-stat-value">{discipline?.summary.inPolicyCount ?? inPolicyTrades.length}</span>
                  <span className="journal-stat-label">In Policy</span>
                </div>
                <div className="journal-stat">
                  <span className="journal-stat-value">{discipline?.summary.overrideCount ?? overrideTradesClosed.length}</span>
                  <span className="journal-stat-label">Overrides</span>
                </div>
              </div>
            </div>

            <div className="journal-discipline-card">
              <h3>Performance Impact</h3>
              <div className="journal-discipline-stats">
                <div className="journal-stat">
                  <span className={`journal-stat-value ${(discipline?.summary.inPolicyPnl ?? inPolicyPnl) >= 0 ? "pnl-pos" : "pnl-neg"}`}>
                    {fmtPnl(discipline?.summary.inPolicyPnl ?? inPolicyPnl)}
                  </span>
                  <span className="journal-stat-label">In-Policy PnL</span>
                </div>
                <div className="journal-stat">
                  <span className={`journal-stat-value ${(discipline?.summary.overridePnl ?? overridePnl) >= 0 ? "pnl-pos" : "pnl-neg"}`}>
                    {fmtPnl(discipline?.summary.overridePnl ?? overridePnl)}
                  </span>
                  <span className="journal-stat-label">Override PnL</span>
                </div>
              </div>
            </div>

            <div className="journal-discipline-card journal-score-card">
              <h3>Discipline Score</h3>
              <div
                className="journal-score-display"
                data-level={
                  (discipline?.score ?? 0) >= 80 ? "green"
                    : (discipline?.score ?? 0) >= 50 ? "amber"
                    : "red"
                }
              >
                {discipline?.score != null ? Math.round(discipline.score) : "—"}
              </div>
              <p className="journal-score-period">
                {discipline?.summary.weekStart && discipline?.summary.weekEnd
                  ? `${fmtDate(discipline.summary.weekStart)} – ${fmtDate(discipline.summary.weekEnd)}`
                  : "Current week"}
              </p>
            </div>

            <div className="journal-discipline-card">
              <h3>All-Time Summary</h3>
              <div className="journal-discipline-stats">
                <div className="journal-stat">
                  <span className="journal-stat-value">{closedTrades.length}</span>
                  <span className="journal-stat-label">Total Closed</span>
                </div>
                <div className="journal-stat">
                  <span className="journal-stat-value">{inPolicyTrades.length}</span>
                  <span className="journal-stat-label">In Policy</span>
                </div>
                <div className="journal-stat">
                  <span className="journal-stat-value">{overrideTradesClosed.length}</span>
                  <span className="journal-stat-label">Overrides</span>
                </div>
                <div className="journal-stat">
                  <span className="journal-stat-value">
                    {closedTrades.length > 0
                      ? `${Math.round((inPolicyTrades.length / closedTrades.length) * 100)}%`
                      : "—"}
                  </span>
                  <span className="journal-stat-label">Compliance Rate</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
