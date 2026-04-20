"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BookOpen, ShieldAlert, TrendingUp } from "lucide-react";
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
};

/* ---------- helpers ---------- */

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

/* ---------- component ---------- */

export default function JournalClient({ trades, overrides }: JournalClientProps) {
  const [tab, setTab] = useState<Tab>("trades");
  const [discipline, setDiscipline] = useState<DisciplineData | null>(null);

  useEffect(() => {
    fetch("/api/discipline")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setDiscipline(d); })
      .catch(() => {});
  }, []);

  /* ---------- derived data ---------- */

  // group overrides by rule broken
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

  /* ---------- discipline stats ---------- */

  const closedTrades = trades.filter((t) => t.state === "closed");
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
        </p>
      </header>

      {/* Tab bar */}
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

      {/* ---------- ALL TRADES TAB ---------- */}
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

      {/* ---------- OVERRIDES TAB ---------- */}
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

              {/* Review loop prompt (§11.3) */}
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

      {/* ---------- DISCIPLINE TAB ---------- */}
      {tab === "discipline" && (
        <div className="journal-panel">
          <div className="journal-discipline-grid">
            {/* Weekly summary */}
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

            {/* Performance impact */}
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

            {/* Discipline Score */}
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

            {/* All-time stats */}
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
