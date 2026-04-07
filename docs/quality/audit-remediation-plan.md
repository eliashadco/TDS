# TDS Audit Remediation Plan

Updated: 2026-04-03

Preview status:
- VS Code preview opened against `http://localhost:3004`
- Local dev server running from `tds/`

## Objective

Turn the latest audit findings into an execution-ready remediation sequence that preserves the product's intent:
- the platform should execute the user's own strategy,
- presets should exist for beginners,
- onboarding should teach the workflow,
- ongoing use should deepen strategy quality rather than hide it behind defaults or silent fallbacks.

## Execution Order

1. Strategy integrity foundation: items 1, 2, 3, 4
2. Strategy model upgrade: items 5 and 7
3. Analytics correctness and scale: items 6 and 8

---

## 1. Make Mode Onboarding Explicit

### Problem
- New users are silently assigned `swing` mode by default.
- The onboarding walkthrough says mode selection is a hard gate, but the product does not enforce that.

### Target Outcome
- Every new user makes an explicit first-session mode choice.
- Product copy, onboarding, and runtime behavior all match.

### Implementation
- Remove the default mode bootstrap from profile creation.
- Allow `profiles.mode` to be nullable until the user chooses a mode.
- Keep `AppShell` mode modal as the blocking first-run gate.
- Route post-login and post-signup users into the shell with the mode modal visible, not silently configured.
- Update onboarding copy only if the flow changes from a strict gate to a soft recommendation.

### Likely Files
- `supabase/migrations/001_profiles.sql` or a new forward migration
- `lib/supabase/protected-app.ts`
- `components/layout/AppShell.tsx`
- `components/layout/ModeSelector.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/signup/page.tsx`
- `components/onboarding/LandingWalkthrough.tsx`

### Acceptance Criteria
- A brand-new user lands in the authenticated shell with no active mode and must choose one.
- No page silently behaves as `swing` before selection.
- Existing users keep their stored mode unchanged.

---

## 2. Unify Metrics as the Single Source of Truth

### Problem
- Settings can show zero saved metrics while trade creation, dashboard, and MarketWatch silently fall back to mode presets.

### Target Outcome
- The metric stack visible in Settings is the exact same stack used everywhere else.
- There is no hidden fallback that makes the UI lie about the active strategy.

### Implementation
- Introduce a single resolver function for the active metric stack per user and mode.
- On first mode selection, seed persisted default metrics for that mode into `user_metrics`.
- Remove page-level `buildMetricsForMode(mode)` fallbacks from dashboard, trade creation, and portfolio analytics.
- Replace them with persisted metrics reads only.
- If persisted metrics are missing unexpectedly, show an explicit recovery state with a button to reseed defaults.

### Likely Files
- new helper in `lib/trading/` or `lib/supabase/`
- `app/(app)/dashboard/page.tsx`
- `app/(app)/trade/new/page.tsx`
- `app/(app)/portfolio-analytics/page.tsx`
- `app/(app)/settings/metrics/page.tsx`
- `components/layout/ModeSelector.tsx`

### Acceptance Criteria
- Settings, New Trade, MarketWatch, Dashboard, and Portfolio Analytics all report the same metric count for a mode.
- Deleting or adding metrics in Settings immediately changes live scoring behavior everywhere.
- Missing metrics never fail open into silent presets.

---

## 3. Preserve Custom Metric Semantics in AI Evaluation

### Problem
- User-written metric descriptions are stored, but AI scoring replaces them with generic or preset direction text.
- Custom strategies therefore look editable but are not truly evaluated as authored.

### Target Outcome
- If a user defines a metric, the AI receives that exact metric meaning.
- Preset metrics still use curated direction-aware descriptions.
- The system executes the user's strategy, not a generic approximation.

### Implementation
- Build a metric prompt resolver with this priority order:
  1. persisted custom metric description,
  2. persisted preset metric description if customized by the user,
  3. curated preset direction description for library metrics.
- Pass both metric `name` and final resolved `description` into AI assessment.
- Update MarketWatch scoring, thesis assessment, and portfolio refresh to use the same resolver.
- Update trade detail and historical displays so stored metric names/descriptions are preserved when available.

### Likely Files
- new helper near `lib/ai/direction.ts`
- `components/trade/NewTradeClient.tsx`
- `components/marketwatch/MarketWatchClient.tsx`
- `components/dashboard/SmartWatchlistCard.tsx`
- `components/analytics/PortfolioAnalyticsOverview.tsx`
- `components/trade/TradeDetailClient.tsx`

### Acceptance Criteria
- A custom metric like “Weekly relative strength versus SOXX with earnings drift confirmation” is sent to AI exactly as written.
- Unknown custom metric IDs do not degrade to generic “supports LONG thesis” copy unless no authored description exists.
- Strategy outputs materially reflect user-authored logic.

---

## 4. Harden AI Assessment Caching

### Problem
- Assessment caching ignores thesis, setup stack, asset class, and metric composition.
- Different strategies on the same ticker/mode can reuse stale AI responses.

### Target Outcome
- Cache reuse only happens when the assessment inputs are meaningfully identical.
- Strategy iteration feels reliable, not randomly sticky.

### Implementation
- Replace the current broad cache key with a stable hash of:
  - ticker
  - direction
  - mode
  - asset
  - thesis text
  - setup list
  - metric IDs
  - resolved metric descriptions
- Keep the 4-hour TTL, but scope it to identical payloads.
- Add a debug-safe response header or server log path for cache hit/miss tracing during QA.
- Ensure reruns after metric edits or strategy changes generate a fresh evaluation.

### Likely Files
- `app/api/ai/assess/route.ts`
- small helper in `lib/api/` or `lib/ai/`

### Acceptance Criteria
- Two different strategies on the same ticker in the same mode cannot share a cached assessment.
- Re-running the exact same assessment still hits cache.
- QA can verify cache correctness without guesswork.

---

## 5. Introduce First-Class User Strategies

### Product Direction
- The app should be strategy-first, not metric-list-first.
- Advanced users need fully custom strategies.
- Beginners need guided presets, tutorial support, and an ongoing learning loop.

### Target Outcome
- Users create, name, save, version, and apply their own strategies.
- Presets exist as starter playbooks, not hidden system defaults.
- The platform teaches strategy construction and refinement over time.

### Solution

#### A. Create a strategy domain model
- Add user-owned strategies with fields such as:
  - `id`
  - `user_id`
  - `mode`
  - `name`
  - `description`
  - `is_preset_clone`
  - `status` (`draft`, `active`, `archived`)
  - `learning_goal`
- Add a version/snapshot table so strategy changes are versioned, not overwritten.
- Store structured thesis helpers per strategy:
  - preferred setup types
  - preferred conditions
  - preferred chart patterns
  - sizing posture notes
  - invalidation style

#### B. Make metrics belong to strategies, not just modes
- Move from one mode-level metric stack to strategy-level metric binding.
- A mode becomes the operating lane.
- A strategy becomes the actual scoring system.

#### C. Provide beginner presets as guided starting points
- Ship presets like:
  - Conservative Swing Long
  - Earnings Momentum Continuation
  - Intraday VWAP Trend
  - Mean Reversion Reclaim
- Presets should be cloned into the user's workspace on adoption, not edited in place.
- Each preset should include:
  - what it is for
  - when not to use it
  - setup examples
  - default metrics
  - risk guidance

#### D. Add a strategy tutorial and learning loop
- Add a “Build your strategy” guided flow with progressive steps:
  1. choose a starting point: blank or preset
  2. define market style and time horizon
  3. choose evidence types
  4. write metric meanings
  5. define acceptable setups and invalidation logic
  6. test on sample instruments
- Add ongoing feedback after live usage:
  - missing dimensions
  - redundant checks
  - strongest setup families
  - weakest setup families
  - where the strategy performs best by mode/source

#### E. Surface strategy selection throughout the app
- New Trade: choose a saved strategy before thesis entry.
- MarketWatch preview: score with a saved strategy, not just “general strategy” or ticker history.
- Dashboard: ready trades should show the strategy used.
- Portfolio Analytics: review results by strategy and strategy version.

### Likely Files and Areas
- new migrations for strategies and strategy_versions
- new strategy types under `types/`
- Settings replacement or expansion from “metrics editor” to “strategy studio”
- `components/trade/NewTradeClient.tsx`
- `components/marketwatch/InstrumentPreviewDrawer.tsx`
- `components/marketwatch/MarketWatchClient.tsx`
- `components/dashboard/ReadyTradesCard.tsx`
- `components/analytics/PortfolioAnalyticsOverview.tsx`

### Acceptance Criteria
- A user can build a custom strategy, save it, reuse it on multiple instruments, and understand exactly what it evaluates.
- A beginner can start from a preset and learn why it works.
- Every trade and workbench item is tied to a named strategy.

---

## 6. Refresh All Active Trades in Portfolio Analytics

### Problem
- Strategy refresh stops at eight active trades.

### Target Outcome
- Every active trade receives a refresh result.
- The page remains responsive even with larger books.

### Fix
- Remove the hard `slice(0, 8)` cap.
- Replace it with a bounded concurrency queue if needed.
- Render per-row loading states while late rows resolve.
- If AI quota or latency is a concern, degrade gracefully with row-level fallback scoring rather than dropping rows.

### Likely Files
- `components/analytics/PortfolioAnalyticsOverview.tsx`

### Acceptance Criteria
- 1 trade, 8 trades, and 20+ trades all show refresh output for every row.
- The page remains usable during refresh.

---

## 7. Snapshot Historical Strategy State to Preserve Original Intent

### Problem
- Historical trades and saved MarketWatch workbench items lose original strategy meaning after metric edits.

### Target Outcome
- A trade always retains the exact strategy logic it was created with.
- Historical review reflects original intent, not current settings drift.

### Fix
- Snapshot strategy metadata onto every trade at creation time:
  - strategy id
  - strategy version id
  - strategy name
  - metric list with resolved descriptions
  - setup stack
  - condition stack
  - pattern
  - strategy notes
- Snapshot the same structure onto saved MarketWatch workbench entries.
- Update historical strategy reuse to prefer the stored snapshot rather than reconstructing from current settings.
- Update trade detail to read snapshot data first, then fall back only if snapshot is missing for legacy rows.

### Likely Files
- new trade/workbench schema changes
- `components/trade/NewTradeClient.tsx`
- `components/marketwatch/MarketWatchClient.tsx`
- `components/trade/TradeDetailClient.tsx`
- `app/(app)/trade/[id]/page.tsx`

### Acceptance Criteria
- Editing a strategy later does not change the meaning of past trades.
- Reusing a historical MarketWatch strategy reuses its original snapshot, not a reconstructed approximation.

---

## 8. Split Modeled Review from Realized Performance Analytics

### Problem
- The portfolio review layer uses modeled R outcomes from exit flags, but the UI reads like realized performance analytics.

### Target Outcome
- Users can distinguish between:
  - system/process review,
  - realized execution performance.

### Solution

#### Phase 1: honest labeling
- Rename the current analytics surface to clearly indicate modeled/system review where appropriate.
- Add explanation copy for how current R values are derived.

#### Phase 2: realized performance engine
- Extend closed-trade analytics to use actual execution fields where available:
  - entry price
  - stop loss
  - exit price
  - tranche exits
  - close reason
- Compute realized R and realized P&L from actual stored values.
- Preserve the modeled view as a separate “Process Review” tab or card.

#### Phase 3: strategy-level learning
- Add reporting by:
  - strategy
  - strategy version
  - setup family
  - source
  - mode
- Show both:
  - realized execution quality
  - process compliance quality

### Likely Files
- `lib/trading/analytics.ts`
- `components/analytics/AnalyticsClient.tsx`
- `components/analytics/PortfolioAnalyticsOverview.tsx`
- trade close/update flows if missing realized fields

### Acceptance Criteria
- Users can see whether a strategy is good but executed poorly, or poor on its own merits.
- Portfolio analytics no longer overstates modeled outcomes as realized results.

---

## Recommended Delivery Phases

### Phase A: integrity and trust
- Item 1
- Item 2
- Item 3
- Item 4

### Phase B: strategy-first product model
- Item 5
- Item 7

### Phase C: analytics quality
- Item 6
- Item 8

## Suggested QA Scenarios

1. New user signs up, is forced to choose mode, and receives seeded starter strategies.
2. User edits a custom metric description and sees changed AI output on the next assessment.
3. Two different strategies on the same ticker produce different assessment results without cache collision.
4. User saves a custom strategy, scores a MarketWatch symbol with it, and later deploys from the workbench.
5. User edits the strategy after deployment and verifies old trades still show the original snapshot.
6. Portfolio Analytics refreshes all active trades, not just the first eight.
7. Modeled process review and realized performance are clearly separated in analytics.
