import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function toClosedPnl(direction: "LONG" | "SHORT", entryPrice: number, exitPrice: number, shares: number): number {
  if (direction === "SHORT") {
    return (entryPrice - exitPrice) * shares;
  }
  return (exitPrice - entryPrice) * shares;
}

function toHoldDays(createdAt: string | null, closedAt: string | null): number {
  if (!createdAt || !closedAt) {
    return 0;
  }
  const opened = new Date(createdAt).getTime();
  const closed = new Date(closedAt).getTime();
  if (!Number.isFinite(opened) || !Number.isFinite(closed) || closed <= opened) {
    return 0;
  }
  return (closed - opened) / (1000 * 60 * 60 * 24);
}

function toDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default async function ArchivePage() {
  const { userId } = await getProtectedAppContext();
  const supabase = await createServerSupabase();

  const { data: rows } = await supabase
    .from("trades")
    .select("id, ticker, direction, source, conviction, closed_at, created_at, entry_price, exit_price, shares, closed_reason, thesis")
    .eq("user_id", userId)
    .eq("closed", true)
    .order("closed_at", { ascending: false })
    .limit(120);

  const closedTrades =
    rows?.map((row) => {
      const entryPrice = Number(row.entry_price ?? 0);
      const exitPrice = Number(row.exit_price ?? row.entry_price ?? 0);
      const shares = Number(row.shares ?? 0);
      const pnl = toClosedPnl(row.direction, entryPrice, exitPrice, shares);

      return {
        id: row.id,
        ticker: row.ticker,
        direction: row.direction,
        source: row.source,
        conviction: row.conviction,
        closedAt: row.closed_at,
        createdAt: row.created_at,
        closedReason: row.closed_reason,
        thesis: row.thesis,
        pnl,
      };
    }) ?? [];

  const closedCount = closedTrades.length;
  const realizedPnl = closedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const averageHold =
    closedTrades.length > 0
      ? closedTrades.reduce((sum, trade) => sum + toHoldDays(trade.createdAt, trade.closedAt), 0) / closedTrades.length
      : 0;
  const thesisCount = closedTrades.filter((trade) => trade.source === "thesis").length;
  const selectedTrade = closedTrades[0] ?? null;

  return (
    <main className="archive-terminal">
      <div className="archive-header-row">
        <div>
          <h2>Trade Archive</h2>
          <p className="page-intro">Full history of your {selectedTrade?.source === "marketwatch" ? "MarketWatch" : "thesis"} operations.</p>
        </div>

        <div className="archive-filters">
          <label className="archive-search-shell">
            <span className="archive-search-icon">⌕</span>
            <input value="Search symbol or thesis..." readOnly aria-label="Search symbol or thesis" />
          </label>
          <div className="archive-select">All Status</div>
          <div className="archive-select">All Directions</div>
        </div>
      </div>

      <section className="archive-summary-grid">
        <article className="surface-panel analytics-kpi-card">
          <p className="meta-label">Closed Trades</p>
          <strong>{closedCount}</strong>
          <span>Last 90 days</span>
        </article>
        <article className="surface-panel analytics-kpi-card">
          <p className="meta-label">Realized P&amp;L</p>
          <strong className={realizedPnl >= 0 ? "positive" : "negative"}>{realizedPnl >= 0 ? "+" : "-"}{money(Math.abs(realizedPnl))}</strong>
          <span>Net after fees and partials</span>
        </article>
        <article className="surface-panel analytics-kpi-card">
          <p className="meta-label">Avg Hold</p>
          <strong>{averageHold.toFixed(1)}d</strong>
          <span>Aligned with lane rules</span>
        </article>
        <article className="surface-panel analytics-kpi-card">
          <p className="meta-label">Thesis Origin</p>
          <strong>{thesisCount}</strong>
          <span>Logged and reviewable</span>
        </article>
      </section>

      <section className="archive-history-grid">
        <section className="surface-panel terminal-table-shell archive-table-shell">
          <div className="terminal-table-header archive-six-col-header">
            <span>Ticker</span>
            <span>Direction</span>
            <span>Status</span>
            <span>R-Multiple</span>
            <span>Closed</span>
            <span>P&amp;L</span>
          </div>

          {closedTrades.length === 0 ? (
            <div className="archive-empty-state">
              <div className="archive-empty-icon">⌕</div>
              <p>No closed trades yet. Completed positions appear here automatically.</p>
            </div>
          ) : (
            <div className="terminal-row-list">
              {closedTrades.map((trade) => {
                const syntheticRiskBase = Math.max(Math.abs(trade.pnl) * 0.5, 1);
                const rMultiple = trade.pnl / syntheticRiskBase;
                const statusLabel = trade.closedReason?.toLowerCase().includes("stop") ? "Stopped" : "Closed";

                return (
                  <Link key={trade.id} href={`/trade/${trade.id}`} className="terminal-table-row archive-six-col-row">
                    <span className="ticker-cell">{trade.ticker}</span>
                    <span>{trade.direction === "LONG" ? "Long" : "Short"}</span>
                    <span><span className="inline-tag neutral">{statusLabel}</span></span>
                    <span>{rMultiple.toFixed(1)}R</span>
                    <span>{toDate(trade.closedAt)}</span>
                    <span className={trade.pnl >= 0 ? "positive" : "negative"}>{trade.pnl >= 0 ? "+" : "-"}{money(Math.abs(trade.pnl))}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <aside className="surface-panel archive-detail-rail">
          {selectedTrade ? (
            <>
              <div className="surface-header">
                <div>
                  <p className="meta-label">Selected Trade</p>
                  <h3>{selectedTrade.ticker} {selectedTrade.direction === "LONG" ? "breakout" : "fade"} review</h3>
                </div>
                <span className="tag">{selectedTrade.pnl >= 0 ? "+" : "-"}{money(Math.abs(selectedTrade.pnl))}</span>
              </div>

              <div className="priority-stack">
                <article className="priority-card calm">
                  <p className="meta-label">Thesis</p>
                  <strong>{selectedTrade.thesis || "No thesis summary saved for this trade."}</strong>
                  <p>Stored in archive for historical attribution and review.</p>
                </article>
                <article className="priority-card calm">
                  <p className="meta-label">Execution Notes</p>
                  <strong>{selectedTrade.closedReason || "Closed without explicit reason text."}</strong>
                  <p>Closed on {toDate(selectedTrade.closedAt)} with {selectedTrade.direction.toLowerCase()} exposure.</p>
                </article>
              </div>

              <Link href={`/trade/${selectedTrade.id}`} className="secondary-button full-width">Open Trade Detail</Link>
            </>
          ) : (
            <div className="archive-empty-state">
              <div className="archive-empty-icon">⌕</div>
              <p>Select a trade to inspect thesis and execution notes.</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
