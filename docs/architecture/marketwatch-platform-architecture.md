# TDS MarketWatch Architecture and Replication Guide

This document is the permanent technical reference for rebuilding the current Intelligent Investors / TDS platform from scratch, with emphasis on the MarketWatch concept, behavior, dependencies, and API contract.

It is written against the current repository state, not the original scaffold brief.

For the full-platform architecture beyond MarketWatch, see `docs/architecture/full-platform-architecture.md`.

This MarketWatch document intentionally does not contain live secret values. It describes required secret names, usage, and retrieval paths only.

## 1. Product Intent

TDS is a strategy-first, mode-aware, direction-aware trading operating system.

MarketWatch is not just a quote table. Its purpose is to:

- surface a live or fallback list of actively moving symbols,
- preview a symbol in context before scoring,
- score that symbol against a saved strategy lane,
- persist the result as a saved workbench item,
- allow lightweight planning of entry and stop before deployment,
- convert only qualified workbench items into live trades.

The MarketWatch surface is therefore the bridge between market discovery and disciplined execution.

## 2. Current Route Topology

Primary user-facing routes relevant to this document:

- `/portfolio-analytics` -> unified workspace parent route.
- `/portfolio-analytics?tab=marketwatch` -> current MarketWatch home.
- `/marketwatch` -> permanent redirect to `/portfolio-analytics?tab=marketwatch`.
- `/dashboard` -> destination after MarketWatch deploy.
- `/trade/new` -> manual thesis-first trade creation flow.
- `/trade/[id]` -> live trade detail and reassessment view.
- `/settings/metrics` -> strategy creation and editing.

Relevant route files:

- `app/(app)/portfolio-analytics/page.tsx`
- `app/(app)/marketwatch/page.tsx`
- `components/marketwatch/MarketWatchClient.tsx`
- `components/marketwatch/MoversTable.tsx`
- `components/marketwatch/InstrumentPreviewDrawer.tsx`
- `components/marketwatch/ScoredList.tsx`

## 3. Current Stack

Application stack:

- Next.js 14 App Router
- React 18
- TypeScript strict mode
- Tailwind CSS
- Supabase auth + Postgres + RLS
- Polygon market data with Yahoo fallback
- Anthropic, Gemini, and Groq for AI routing
- Resend for notifications

Runtime boundaries:

- client components handle interaction and staged state,
- server components load protected workspace data,
- `/api/*` routes hold AI and market-data access,
- Supabase is the system of record for profile, strategies, watchlist, and trades.

## 4. Required Environment Variables

The repo intentionally does not store live credential values. Re-establishing the platform means supplying the following values in environment files or deployment settings.

Current local example in `.env.local.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514

AI_PROVIDER=gemini
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

POLYGON_API_KEY=

RESEND_API_KEY=

NEXT_PUBLIC_APP_URL=
```

Current production example in `.env.production.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
POLYGON_API_KEY=
RESEND_API_KEY=
ALERT_FROM_EMAIL=
```

What each variable currently does:

- `NEXT_PUBLIC_SUPABASE_URL`: used by browser auth, server auth refresh, and protected app context.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public client credential used by browser and server Supabase clients. This must come from the active Supabase project. Do not hardcode it in source.
- `SUPABASE_SERVICE_ROLE_KEY`: required for Supabase Edge Functions and privileged background jobs.
- `AI_PROVIDER`: routing preference. Current development default is `gemini`; production example uses `anthropic`.
- `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`: provider credentials used by `/api/ai/*` routes.
- `POLYGON_API_KEY`: primary live quote, candles, and movers feed source.
- `RESEND_API_KEY`: notification delivery for Supabase functions.
- `ALERT_FROM_EMAIL`: sender used by scheduled email alerts.
- `NEXT_PUBLIC_APP_URL`: public app URL for auth redirects and app-level links.

Provider resolution behavior in current code:

- If `AI_PROVIDER=anthropic`, only Anthropic is used.
- If `AI_PROVIDER=groq`, only Groq is used.
- If `AI_PROVIDER=gemini`, Gemini is used.
- If `AI_PROVIDER=auto`, the resolver prefers Gemini in non-production when configured, then Groq, then Anthropic.
- When Gemini fails and Groq is configured, the app retries on Groq.

Relevant files:

- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `middleware.ts`
- `lib/ai/provider.ts`
- `docs/deployment/vercel-production.md`

## 5. Local Supabase Baseline

Local Supabase CLI config currently assumes:

- API: `http://127.0.0.1:54321`
- DB: port `54322`
- Studio: `54323`
- App auth site URL: `http://127.0.0.1:3000`

See `supabase/config.toml`.

To rebuild locally:

1. Install the Supabase CLI.
2. Run `supabase start`.
3. Apply migrations with `supabase db reset` or `supabase db push`.
4. Copy the generated local API URL and anon key into `.env.local`.
5. Run `npm install` and `npm run dev`.

## 6. Database Requirements

Core application minimum for current MarketWatch behavior:

- `001_profiles.sql`
- `002_metrics.sql`
- `003_trades.sql`
- `004_watchlist.sql`
- `005_rls_policies.sql`
- `007_rate_limits.sql`
- `009_explicit_mode_onboarding.sql`
- `010_first_class_strategies.sql`
- `011_strategy_library_and_reassessment.sql`

Operational and scheduling additions that should still be part of full cold rebuilds:

- `006_notification_jobs.sql`
- `008_notification_jobs_use_vault.sql`

Migration policy note:

- the subset above describes app boot dependencies, not long-term schema parity policy.
- for reproducible environments, apply the full migration chain.

Critical tables for MarketWatch behavior:

- `profiles`
- `user_strategies`
- `strategy_versions`
- `user_metrics`
- `watchlist_items`
- `trades`
- `user_trade_structure_items`

Key MarketWatch-related schema behavior:

- `watchlist_items` stores staged names, saved scores, workbench planner data, verdict, and strategy linkage.
- `trades` stores confirmed deployed workbench items and full thesis metadata.
- `user_strategies` stores named strategy lanes per mode.
- `strategy_versions` freezes strategy snapshots for reproducibility.
- `user_metrics` stores the active metric stack per strategy.
- `user_trade_structure_items` stores reusable setup types, conditions, and chart patterns.

Important constraints:

- `watchlist_items` uniqueness is strategy-aware after migration `011`: `(user_id, strategy_id, ticker, direction)`.
- `trades` and `watchlist_items` both support `strategy_id`, `strategy_version_id`, `strategy_name`, and `strategy_snapshot` after migration `010`.
- RLS policies require `auth.uid()` ownership.

If `010_first_class_strategies.sql` is missing, strategy-first pages deliberately stop and show a setup panel rather than rendering incorrectly.

## 7. Authentication and Protected App Rules

Protected route prefixes:

- `/dashboard`
- `/trade`
- `/marketwatch`
- `/analytics`
- `/portfolio-analytics`
- `/settings`

Protection behavior:

- edge middleware checks whether the user is authenticated,
- protected server components call `getProtectedAppContext()`,
- if unauthenticated, the user is redirected to `/login`.

Mode behavior:

- if `profiles.mode` is null, the shell forces mode selection,
- most app pages render `WorkspaceSetupPanel` until mode is set,
- strategy-first pages also require strategy tables and at least one enabled strategy.

## 8. MarketWatch Conceptual Model

MarketWatch is a four-stage system:

1. Feed acquisition.
2. Preview and strategy selection.
3. Strategy scoring and workbench persistence.
4. Deploy to live trade.

The intended operator flow is:

1. Open MarketWatch.
2. Review active movers or import custom tickers.
3. Preview one symbol.
4. Choose direction and scoring strategy.
5. Score the symbol against that strategy.
6. Save the result in the workbench.
7. Enter entry and stop.
8. Deploy to the portfolio only when conviction and sizing resolve.

This means MarketWatch behaves as a controlled queue, not a loose watchlist.

## 9. Current MarketWatch Runtime Flow

### 9.1 Feed Load

On mount, `MarketWatchClient` requests:

- `GET /api/market/premarket?limit=18`

This route calls `getPremarketFeed(limit)` in `lib/market/movers.ts`.

Feed resolution order:

1. Polygon top gainers and losers snapshot.
2. Curated fallback universe ranked by liquidity and active change if the provider feed is empty.
3. Local starter universe if Polygon is not configured.

The client surfaces feed quality using labels such as:

- `Live`
- `Curated Fallback`
- `Starter Universe`
- `Feed Attention`

### 9.2 Watchlist Load

In parallel, MarketWatch loads persisted staged rows from Supabase:

- table: `watchlist_items`
- filter: `user_id = current user`
- filter: `mode = current mode`

Rows are normalized into local `WatchlistItemView` objects.

Each row may contain:

- raw mover context,
- strategy linkage,
- a `scores.workbench` object holding the scored workbench item,
- verdict and note,
- last scored timestamp.

### 9.3 Preview

When the user clicks `Preview`:

1. the preview drawer opens,
2. the client fetches `GET /api/market/quote?ticker=...`,
3. the client loads the latest historical trades for that ticker from `trades`,
4. the client builds strategy options from both:
   - current saved strategies,
   - historical strategy snapshots previously used on that ticker.

This makes the preview drawer both a quote context panel and a strategy selection panel.

### 9.4 Score Against Strategy

When the user clicks `Score selected strategy`:

1. the selected strategy's enabled metrics are collected,
2. each metric description is rewritten through `resolveMetricAssessmentDescription(metric, direction)`,
3. the client POSTs to `/api/ai/assess`,
4. the response is converted into pass/fail score maps,
5. pass rate, verdict, and conviction are computed locally,
6. the workbench item is persisted back into `watchlist_items`.

Verdict thresholds in MarketWatch are currently:

- `GO` if pass rate >= 85%
- `CAUTION` if pass rate >= 65% and < 85%
- `SKIP` otherwise

Conviction is stricter than verdict and uses the global trade rules:

- fundamentals must pass at 70% minimum,
- technicals must pass at 100%,
- then conviction becomes `MAX`, `HIGH`, or `STD` based on combined percentage.

This means a MarketWatch item can be visually interesting without being mechanically deployable.

### 9.5 Workbench Planning

The workbench is the persistent planning queue.

Its purpose is to hold:

- ticker,
- direction,
- strategy lane,
- pass rate and verdict,
- conviction,
- thesis summary,
- note map,
- entry,
- stop,
- trigger level,
- strategy snapshot.

Entry and stop edits are saved back into the serialized workbench payload in `watchlist_items` so refreshes do not erase planning.

### 9.6 Deploy to Trade

When `Deploy trade` is clicked:

1. the client verifies the item has conviction, entry, and stop,
2. `calculatePosition()` computes shares, tranches, and targets,
3. a new row is inserted into `trades`,
4. the source watchlist row is removed,
5. the user is redirected to `/dashboard`.

Deploy always inserts with:

- `source = 'marketwatch'`
- `confirmed = true`
- `closed = false`

The trade record carries forward strategy linkage and snapshot metadata so later analytics and reassessment can reproduce the original lane.

Risk note:

- deployment relies on persisted workbench state and strategy snapshot integrity.
- reset and destructive flows should be guarded with explicit confirmation controls at both UI and API boundaries.

## 10. Current MarketWatch API Surface

### Core routes used directly by MarketWatch

- `GET /api/market/premarket`
  - source for the active tape
  - returns `movers`, `source`, `status`, `message`, `asOf`

- `GET /api/market/quote?ticker=...`
  - used by preview drawer
  - cache-first with stale fallback behavior

- `POST /api/market/enrich`
  - used for pasted ticker import
  - accepts raw text or explicit ticker array
  - returns `movers`, `parsedTickers`, `unresolvedTickers`

- `POST /api/ai/assess`
  - used for MarketWatch scoring
  - accepts ticker, direction, thesis, setups, conditions, chart pattern, asset, mode, strategy name, strategy instruction, metrics
  - returns strict JSON pass/fail results by metric id

Parser and reliability note:

- current AI parsing is tolerant and can accept wrapped JSON-like content.
- route handlers return explicit parse errors at HTTP level when parsing fails.
- hardening target: route-level schema validation and structured parse-failure diagnostics.

### Adjacent routes used by surrounding workflows

- `GET /api/market/candles`
  - used by trade detail charting

- `POST /api/ai/insight`
  - used by portfolio analytics strategy refresh summaries

- `POST /api/ai/rate`
  - used by Strategy Studio to rate a metric stack

- `POST /api/settings/reset-workspace`
  - used by settings to clear activity or full workspace

## 11. Current MarketWatch Client Behavior

### Feed behavior

- active movers are loaded on mount,
- manual refresh broadcasts `tds:market-data-refresh`,
- refresh state is shared through local storage key `tds-market-data-refresh-token`,
- the UI shows last manual refresh time.

### Filter behavior

- filter tabs: all, gainers, losers,
- filtering is client-side over the loaded mover set.

### Watchlist behavior

- quick `Watch` action creates a `WATCH` row without AI scoring,
- imported tickers also enter as `WATCH`,
- removing a watchlist row deletes it from Supabase,
- scored items become strategy-linked workbench entries.

### Lane behavior

- each saved strategy becomes a lane bucket,
- watchlist rows are grouped by `strategy_id`,
- a mover can be dragged from the tape into a strategy lane,
- drop triggers automatic scoring into that lane.

### Preview behavior

- direction defaults from price move sign,
- strategy selection can come from active saved strategies or historical snapshots,
- preview shows quote status label, trigger level, current conviction label if one exists, and metric labels for the selected strategy.

## 12. AI Contract for MarketWatch

MarketWatch does not talk directly to Anthropic, Gemini, or Groq. It only talks to the internal assess route.

Current request target:

- `POST /api/ai/assess`

Current prompt assembly source:

- `lib/ai/prompts.ts` -> `buildAssessmentPrompt()`

Current provider execution source:

- `lib/ai/provider.ts` -> `createAIJsonCompletion()`

Current expected response shape:

```json
{
  "metric_id": {
    "v": "PASS",
    "r": "one sentence reason"
  }
}
```

Current safety and performance rules:

- request body is sanitized,
- AI requests are rate-limited,
- responses are cached for 4 hours using a hash of provider, model, ticker, direction, thesis, mode, strategy context, and metrics,
- response headers include `X-AI-Provider` and `X-AI-Model`.

## 13. Market Data Contract

### Primary provider

- Polygon

### Quote fallback chain

1. Polygon snapshot
2. Polygon previous day aggregate
3. Yahoo quote fallback

### Movers fallback chain

1. Polygon top movers snapshot
2. Curated fallback universe
3. Local starter universe

### Candle fallback chain

1. Polygon aggregates
2. Yahoo candle fallback

Caching:

- quote cache TTL: 60 seconds
- stale quote fallback window: 6 hours
- candle cache TTL: 5 minutes
- premarket feed cache is maintained through `lib/market/movers.ts`

Error and fallback visibility requirements:

- MarketWatch should always show feed quality state (`Live`, `Curated Fallback`, `Starter Universe`, or `Feed Attention`).
- Quote and candles fallback behavior should never collapse into blank, unlabelled surfaces.

## 14. Supabase Records Written by MarketWatch

### `watchlist_items`

MarketWatch writes or updates:

- `user_id`
- `strategy_id`
- `strategy_version_id`
- `strategy_name`
- `strategy_snapshot`
- `ticker`
- `direction`
- `asset_class`
- `mode`
- `scores`
- `verdict`
- `note`
- `source`
- `last_scored_at`

Important implementation detail:

- the serialized workbench object is stored inside `scores.workbench`.

### `trades`

Deploy writes:

- strategy metadata
- symbol and direction
- structure fields (`setup_types`, `conditions`, `chart_pattern`)
- thesis summary
- invalidation
- score and note maps
- `f_score`, `t_score`, `f_total`, `t_total`
- conviction tier and `risk_pct`
- entry, stop, shares, tranches
- R targets
- `market_price`
- `confirmed = true`
- `closed = false`
- `source = 'marketwatch'`

## 15. Replication Checklist

Use this checklist to recreate the current platform behavior from scratch.

### Infrastructure

1. Create a new Next.js 14 App Router TypeScript project.
2. Install dependencies from `package.json`.
3. Initialize Supabase locally or create a hosted Supabase project.
4. Apply all current migrations in order.
5. Configure env vars for Supabase, AI providers, Polygon, and Resend.
6. Verify row-level security policies before exposing browser auth flows with anon credentials.

### Auth and Profile

1. Implement Supabase browser and server clients.
2. Add auth middleware for protected routes.
3. Add `profiles` row bootstrap on signup.
4. Ensure `profiles` includes `mode`, `learn_mode`, and `equity`.
5. Validate cross-user data denial for profiles, watchlist, trades, and strategy tables.

### Strategy-first foundation

1. Create `user_strategies` and `strategy_versions` tables.
2. Attach `strategy_id` and `strategy_snapshot` to both `trades` and `watchlist_items`.
3. Build starter strategies per mode.
4. Require at least one enabled saved strategy before rendering MarketWatch.

### MarketWatch

1. Build a parent workspace route with `?tab=marketwatch`.
2. Add a movers table that calls `/api/market/premarket`.
3. Add a preview drawer that loads `/api/market/quote`.
4. Load existing watchlist rows from Supabase by `user_id` and `mode`.
5. Expose saved strategies as drop lanes and selector options.
6. Call `/api/ai/assess` to score a symbol against the selected strategy.
7. Persist scored output into `watchlist_items` as a workbench object.
8. Allow manual entry and stop editing directly in the workbench.
9. Deploy scored items into `trades` using conviction-based sizing.
10. Verify parse-failure behavior for `/api/ai/assess` and ensure user-visible failure messaging is explicit.

### Optional but current production support

1. Deploy Supabase Edge Functions:
   - `tranche-deadline-check`
   - `watchlist-reeval`
2. Set Vault and function secrets for service-role and Resend.
3. Configure Vercel production env vars.

## 16. Non-Negotiable Behavioral Rules

These are the current platform rules and should be preserved in any re-establishment effort.

- API keys never belong in client components.
- Live secret values must not be written to repository docs.
- AI and market-data calls go through internal API routes.
- Mode selection is explicit and required.
- Strategy selection is explicit and required for MarketWatch scoring.
- Direction interpretation is required for every AI metric evaluation.
- Conviction sizing is mechanical, not manual.
- Portfolio heat is a hard constraint elsewhere in the system and should remain enforced in trade creation flows.
- Loading and error states should always be visible.
- Workbench state must persist across refreshes.
- MarketWatch must remain usable when live feeds are degraded by falling back to curated or local universes instead of blank output.

## 19. MarketWatch Hardening Addendum

### 19.1 AI routing and parse reliability

Risk concentration:

- `lib/ai/provider.ts`
- `lib/ai/parser.ts`
- `POST /api/ai/assess`

Hardening expectations:

- enforce schema-level validation for expected assess payloads,
- classify parse failures separately from provider/network failures,
- log provider, model, and failure class for diagnosis,
- include malformed-response regression tests for each configured provider.

### 19.2 Reset blast radius impact on MarketWatch

Risk concentration:

- `POST /api/settings/reset-workspace`

Hardening expectations:

- require a second confirmation artifact for destructive scopes,
- maintain audit logging for scope, actor, and outcome,
- keep scope semantics stable (`activity` vs `full`) to prevent accidental cross-scope behavior drift.

### 19.3 RLS dependency and anon-key exposure

Risk concentration:

- browser-exposed Supabase client flows
- RLS policy correctness

Hardening expectations:

- include RLS verification in rebuild validation,
- test cross-user access denial for all MarketWatch-linked tables,
- treat RLS tests as release gates, not optional QA checks.

### 19.4 Error boundaries and fallback UX

Implementation anchors:

- route-level loading/error boundaries in `app/loading.tsx`, `app/global-error.tsx`, `app/(app)/loading.tsx`, and `app/(app)/error.tsx`
- MarketWatch feed-quality labeling and fallback messaging
- trade chart and quote empty-state fallback behavior when provider fetch fails

Hardening expectations:

- preserve explicit error/fallback labels,
- avoid silent empty panels,
- test degraded-provider scenarios as part of pre-release checks.

### 19.5 PWA and auth freshness

Risk concentration:

- `next-pwa` in production/CI contexts

Hardening expectations:

- verify logout/login freshness under service worker,
- verify protected route freshness after auth transitions,
- verify API caching does not bypass permission or state transitions.

## 17. Files That Define the Current MarketWatch System

Primary runtime files:

- `app/(app)/portfolio-analytics/page.tsx`
- `app/(app)/marketwatch/page.tsx`
- `components/marketwatch/MarketWatchClient.tsx`
- `components/marketwatch/MoversTable.tsx`
- `components/marketwatch/InstrumentPreviewDrawer.tsx`
- `components/marketwatch/ScoredList.tsx`

Primary API files:

- `app/api/market/premarket/route.ts`
- `app/api/market/quote/route.ts`
- `app/api/market/enrich/route.ts`
- `app/api/ai/assess/route.ts`

Primary domain files:

- `lib/market/movers.ts`
- `lib/market/polygon.ts`
- `lib/market/yahoo.ts`
- `lib/market/cache.ts`
- `lib/market/refresh.ts`
- `lib/trading/scoring.ts`
- `lib/trading/strategies.ts`
- `lib/trading/user-metrics.ts`
- `lib/ai/prompts.ts`
- `lib/ai/provider.ts`

Primary schema files:

- `supabase/migrations/003_trades.sql`
- `supabase/migrations/004_watchlist.sql`
- `supabase/migrations/010_first_class_strategies.sql`
- `supabase/migrations/011_strategy_library_and_reassessment.sql`

## 18. Practical Rebuild Summary

If the goal is to recreate the current platform quickly, the minimum viable order is:

1. restore Supabase schema and env vars,
2. restore auth and protected mode-aware shell,
3. restore strategy tables and starter strategy seeding,
4. restore MarketWatch feed routes,
5. restore `/api/ai/assess` and AI provider routing,
6. restore watchlist workbench persistence,
7. restore deploy-from-workbench into `trades`.

If those seven pieces are rebuilt accurately, the core current MarketWatch platform behavior is restored.