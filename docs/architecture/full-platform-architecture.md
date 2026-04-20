# TDS Full Platform Architecture and Rebuild Guide

This document is the full-platform architecture reference for the current Intelligent Investors / TDS codebase.

It is intended to make the system reproducible without leaving critical behavior implicit.

This guide covers:

- product intent,
- route architecture,
- page responsibilities,
- API surface,
- data model,
- AI and market-data providers,
- Supabase and deployment requirements,
- replication order,
- secret inventory and where each value is used.

## 1. Security Boundary

This repository does not store live credentials, and this document does not embed them.

That means this guide includes:

- every required secret name,
- where that secret is consumed,
- which external system it must come from,
- how it affects runtime behavior.

It does not include:

- the real live Supabase anon key,
- the real live Supabase URL,
- the real live Polygon key,
- the real live Gemini key,
- any other actual secret value.

Those values must stay in external secret stores such as:

- local `.env.local`,
- Vercel project environment variables,
- Supabase project settings,
- Supabase Vault or Edge Function secrets.

## 2. Product Definition

TDS is a strategy-first trading operating system.

Current branded presentation in the UI is `Intelligent Investors`, but the architecture and internal naming still refer to `TDS`.

The platform is designed to enforce this sequence:

1. authenticate,
2. choose a trading mode,
3. define or select a strategy lane,
4. evaluate opportunity quality,
5. derive risk and size mechanically,
6. manage live trades with structured journaling,
7. review performance through analytics.

Core product rules:

- mode-awareness is mandatory,
- direction-awareness is mandatory,
- strategy-first storage is mandatory,
- AI and provider keys stay server-side,
- conviction sizing is computed, not freely edited,
- loading and failure states must remain visible,
- fallback data paths should prevent blank market surfaces.

## 3. Technology Stack

Current app stack from `package.json`:

- Next.js 14.2.32
- React 18
- TypeScript 5
- Tailwind CSS 3
- Supabase SSR and JS client
- Anthropic SDK
- Recharts
- lightweight-charts
- Zod
- Resend
- next-pwa

Relevant runtime classes:

- server components handle protected data loading,
- client components handle interactivity and staged state,
- `/app/api/*` routes encapsulate AI and market provider access,
- Supabase is the system of record,
- Supabase Edge Functions provide scheduled alerts.

## 4. Directory Map

Top-level architecture domains:

- `app/`: route entry points, layouts, loading boundaries, error boundaries, API routes.
- `components/`: user-facing interaction and visualization surfaces.
- `lib/`: business logic, AI provider integration, market-data integration, validation, caching, and Supabase helpers.
- `supabase/`: migrations, CLI config, edge functions.
- `types/`: shared type contracts for trades, strategies, market, and database shape.
- `docs/`: deployment, quality, and architecture references.

## 5. Route Architecture

### Public routes

- `/` -> landing page.
- `/login` -> email/password and OAuth login.
- `/signup` -> account creation.

### Protected routes

- `/dashboard`
- `/trade/new`
- `/trade/[id]`
- `/portfolio-analytics`
- `/portfolio-analytics?tab=marketwatch`
- `/marketwatch` -> redirect
- `/analytics` -> redirect
- `/settings/metrics`
- `/settings/profile`

Protection is implemented by:

- `middleware.ts`
- `lib/supabase/protected-app.ts`

Protected prefixes currently enforced:

- `/dashboard`
- `/trade`
- `/marketwatch`
- `/analytics`
- `/portfolio-analytics`
- `/settings`

## 6. Page Responsibilities

### Landing

Files:

- `app/page.tsx`
- `components/onboarding/LandingWalkthrough.tsx`

Intention:

- present the product as a calm investor operating surface,
- explain the workflow at a high level,
- drive users to login or signup.

### Authentication

Files:

- `app/(auth)/login/page.tsx`
- `app/(auth)/signup/page.tsx`
- `lib/supabase/client.ts`

Intention:

- let the user authenticate through Supabase,
- redirect to `/dashboard` on success,
- keep auth setup minimal and explicit.

### Protected Shell

Files:

- `app/(app)/layout.tsx`
- `components/layout/AppShell.tsx`
- `components/layout/NavBar.tsx`
- `components/layout/ModeSelector.tsx`
- `components/layout/TradeDrawer.tsx`

Intention:

- wrap all protected pages in one operating shell,
- show current mode and navigation,
- force mode selection when absent,
- expose learn mode and fast trade navigation.

### Dashboard

Files:

- `app/(app)/dashboard/page.tsx`
- `components/dashboard/DashboardClient.tsx`
- `components/dashboard/ReadyTradesCard.tsx`
- `components/dashboard/SmartWatchlistCard.tsx`
- `components/dashboard/TodaysPrioritiesCard.tsx`

Intention:

- give the user a command-center summary,
- show active heat, live PnL, current strategy, ready trades, staged ideas, and recent closes,
- surface immediate priorities instead of raw tables.

### MarketWatch and Portfolio Analytics Workspace

Files:

- `app/(app)/portfolio-analytics/page.tsx`
- `app/(app)/marketwatch/page.tsx`
- `app/(app)/analytics/page.tsx`
- `components/analytics/PortfolioAnalyticsOverview.tsx`
- `components/analytics/AnalyticsClient.tsx`
- `components/marketwatch/MarketWatchClient.tsx`
- `components/marketwatch/MoversTable.tsx`
- `components/marketwatch/InstrumentPreviewDrawer.tsx`
- `components/marketwatch/ScoredList.tsx`
- `components/marketwatch/QuickExec.tsx`

Intention:

- unify performance review and idea qualification,
- keep discovery, scoring, and accountability in the same workspace,
- prevent MarketWatch from becoming a disconnected scanner.

### New Trade

Files:

- `app/(app)/trade/new/page.tsx`
- `components/trade/NewTradeClient.tsx`
- `components/trade/ThesisStep.tsx`
- `components/trade/AssessmentStep.tsx`
- `components/trade/SizingStep.tsx`
- `components/trade/ConfirmStep.tsx`

Intention:

- provide the manual thesis-first path,
- require explicit thesis and invalidation,
- assess against the active strategy,
- derive size mechanically,
- save a fully structured trade.

### Trade Detail

Files:

- `app/(app)/trade/[id]/page.tsx`
- `components/trade/TradeDetailClient.tsx`
- `components/trade/TradeReassessmentCard.tsx`
- `components/trade/AssessmentMatrix.tsx`
- `components/chart/PriceChart.tsx`

Intention:

- preserve the original trade context,
- show live quote and chart state,
- support journaling and reassessment,
- support close and post-trade review.

### Strategy Studio

Files:

- `app/(app)/settings/metrics/page.tsx`
- `components/settings/MetricsEditorClient.tsx`
- `components/learn/StrategyTemplate.tsx`

Intention:

- let the user create named strategies,
- define enabled metrics,
- store AI guidance and structure defaults,
- publish strategy versions for future trades.

### Profile Settings

Files:

- `app/(app)/settings/profile/page.tsx`
- `components/settings/OnboardingRestartCard.tsx`
- `components/settings/PortfolioResetCard.tsx`
- `components/learn/LearnToggle.tsx`

Intention:

- control workspace-level behavior,
- replay onboarding,
- reset activity or full workspace,
- toggle instructional overlays.

## 7. Full API Surface

### AI routes

- `POST /api/ai/assess`
  - main scoring route for thesis and MarketWatch.
- `POST /api/ai/insight`
  - generates verdict summary, edge, and risks.
- `POST /api/ai/rate`
  - rates a strategy metric stack.
- `POST /api/ai/movers`
  - exposes AI-backed or derived movers payload.

### Market routes

- `GET /api/market/quote`
  - live quote with fallback behavior.
- `GET /api/market/candles`
  - chart candles by symbol and date range.
- `GET /api/market/premarket`
  - top movers feed for MarketWatch.
- `POST /api/market/enrich`
  - pasted ticker enrichment.

### Settings route

- `POST /api/settings/reset-workspace`
  - reset activity or full workspace.

## 8. API Route Intent

### `/api/ai/assess`

Files:

- `app/api/ai/assess/route.ts`
- `lib/ai/prompts.ts`
- `lib/ai/provider.ts`
- `lib/ai/parser.ts`
- `lib/api/security.ts`

Intention:

- sanitize incoming thesis payload,
- rate-limit requests,
- build a direction-aware prompt,
- call the configured AI provider,
- parse JSON pass/fail results and return explicit `500` errors when parsing fails,
- cache results for 4 hours.

Current parser behavior note:

- `lib/ai/parser.ts` is tolerant (fence stripping and first-object regex fallback), which improves recovery but can accept malformed wrappers.
- Routes fail loudly at HTTP level on parse failure (`Failed to parse AI response`), but caller-facing diagnostics are still generic.
- Hardening target: adopt schema-level response validation per route, with structured error metadata for observability.

### `/api/ai/insight`

Intention:

- summarize passed and failed criteria into operational guidance.

### `/api/ai/rate`

Intention:

- judge whether a strategy stack is coherent, missing pieces, or redundant.

### `/api/market/quote`

Files:

- `app/api/market/quote/route.ts`
- `lib/market/polygon.ts`
- `lib/market/cache.ts`

Intention:

- serve quotes with a cache-first strategy,
- hide provider details from clients,
- prevent provider outages from collapsing the UI.

### `/api/market/candles`

Intention:

- serve chart data for trade detail screens.

### `/api/market/premarket`

Files:

- `app/api/market/premarket/route.ts`
- `lib/market/movers.ts`

Intention:

- supply the MarketWatch tape,
- downgrade gracefully to curated or local fallback universes.

### `/api/market/enrich`

Intention:

- convert pasted or imported tickers into enriched mover rows suitable for watchlist staging.

### `/api/settings/reset-workspace`

Intention:

- clear either activity only or the full user workspace,
- reseed starter strategy workspace when applicable.

Risk classification:

- high blast-radius endpoint.
- currently protected by authenticated session checks, but no re-auth prompt or signed confirmation token at API boundary.
- hardening target: require one additional server-verifiable confirmation artifact for destructive scopes.

## 9. AI Provider Architecture

Current provider layer lives in:

- `lib/ai/provider.ts`

Supported providers:

- Anthropic
- Groq
- Gemini

Current model defaults:

- Anthropic: `claude-sonnet-4-20250514`
- Groq: `llama-3.1-8b-instant`
- Gemini: `gemini-2.0-flash`

Current AI routing rules:

- development defaults to Gemini when available,
- Gemini may fall back to Groq when configured,
- production example defaults to Anthropic,
- the client never directly calls provider APIs.

Required secrets for this subsystem:

- `AI_PROVIDER`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

Current secret sources:

- local `.env.local`
- Vercel env vars

## 10. Market Data Architecture

Primary market provider:

- Polygon

Fallback provider:

- Yahoo Finance parsing utilities

Files:

- `lib/market/polygon.ts`
- `lib/market/yahoo.ts`
- `lib/market/movers.ts`
- `lib/market/cache.ts`
- `lib/market/candle-range.ts`
- `lib/market/refresh.ts`

Current market behaviors:

- quotes are cached for 60 seconds,
- stale quotes can be reused up to 6 hours,
- candles are cached for 5 minutes,
- premarket movers are resolved from Polygon first,
- if Polygon movers are empty, the app switches to curated fallback,
- if Polygon is absent locally, the app shows a built-in starter universe rather than a blank interface.

Required secrets for this subsystem:

- `POLYGON_API_KEY`

Current secret sources:

- local `.env.local`
- Vercel env vars

## 11. Supabase Architecture

Supabase responsibilities:

- authentication,
- session refresh,
- profile state,
- user strategy storage,
- version snapshots,
- trades,
- watchlist persistence,
- shared structure library,
- rate limits,
- edge-function scheduled jobs.

Primary files:

- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/protected-app.ts`
- `middleware.ts`
- `supabase/config.toml`

Required Supabase variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Additional Edge Function variable:

- `SUPABASE_URL`

Where they are used:

- browser login and signup pages,
- server auth refresh middleware,
- protected page server loaders,
- edge functions for scheduled alerts,
- deployment configuration.

Important note:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is still a credential and must be sourced from the active Supabase project settings, not hardcoded into repository docs.
- browser exposure of anon credentials is expected; data safety therefore depends on correct RLS policies and policy validation.

## 12. Database Model

### Core tables

- `profiles`
- `user_metrics`
- `trades`
- `watchlist_items`
- `user_strategies`
- `strategy_versions`
- `user_trade_structure_items`

### `profiles`

Purpose:

- stores mode, learn mode, equity, and email identity layer.

### `user_metrics`

Purpose:

- stores enabled metrics per user and strategy.

### `trades`

Purpose:

- stores both thesis-originated and MarketWatch-originated live trades.

Key fields:

- symbol and direction
- structure fields
- score and note maps
- conviction and risk
- entry, stop, size, targets
- journal fields
- source
- strategy snapshot metadata

### `watchlist_items`

Purpose:

- persistent staging area for saved ideas and workbench state.

### `user_strategies`

Purpose:

- stores named strategy lanes, default status, description, learning goal, and AI instruction.

### `strategy_versions`

Purpose:

- immutable snapshots of strategies at publish time.

### `user_trade_structure_items`

Purpose:

- stores reusable setups, conditions, and chart patterns.

## 13. Migration Baseline

Current migration inventory:

- `000_full_schema.sql`
- `001_profiles.sql`
- `002_metrics.sql`
- `003_trades.sql`
- `004_watchlist.sql`
- `005_rls_policies.sql`
- `006_notification_jobs.sql`
- `007_rate_limits.sql`
- `008_notification_jobs_use_vault.sql`
- `009_explicit_mode_onboarding.sql`
- `010_first_class_strategies.sql`
- `011_strategy_library_and_reassessment.sql`

Core application minimum for current user-facing behavior:

- `001` through `005`
- `007`
- `009`
- `010`
- `011`

Operational and scheduling additions:

- `006_notification_jobs.sql`
- `008_notification_jobs_use_vault.sql`

Migration policy note:

- cold rebuilds should generally apply the full migration chain, not only the core subset.
- the subset above is for explaining app boot dependencies, not for long-term schema parity policy.

## 14. Trading Logic Layer

Primary files:

- `lib/trading/scoring.ts`
- `lib/trading/validation.ts`
- `lib/trading/strategies.ts`
- `lib/trading/strategy-presets.ts`
- `lib/trading/presets.ts`
- `lib/trading/user-metrics.ts`
- `lib/trading/structure-library.ts`
- `lib/trading/analytics.ts`

Key exported behavior:

- `getConviction()` -> convert score totals into conviction tier.
- `calculatePosition()` -> convert conviction and risk-per-share into shares and targets.
- `getPortfolioHeat()` -> aggregate active trade exposure.
- `detectContradictions()` -> flag thesis inconsistencies.
- `evaluateGates()` -> enforce fundamental and technical pass thresholds.
- `validatePortfolioHeat()` -> block excess exposure.
- `validatePositionSize()` -> prevent user from sizing below conviction floor.
- `ensureStrategyWorkspaceForMode()` -> load or seed starter strategies.
- `parseStrategySnapshot()` and `buildStrategySnapshot()` -> preserve reproducible strategy state.
- `buildStarterMetricSeed()` -> seed base metrics for a mode or strategy.
- `resolveMetricAssessmentDescription()` -> rewrite metric descriptions by direction.
- `loadSharedTradeStructureLibrary()` -> merge reusable structure vocabulary into the trade flow.
- `calculateAnalytics()` and related functions -> compute modeled and realized performance.

## 15. Learn and Onboarding Layer

Primary files:

- `components/learn/LearnModeContext.tsx`
- `components/learn/LearnToggle.tsx`
- `components/learn/MetricExplainer.tsx`
- `components/learn/StrategyTemplate.tsx`
- `components/onboarding/LandingWalkthrough.tsx`

Intention:

- keep the product usable by less experienced users,
- explain metrics and strategy templates,
- allow onboarding replay without resetting auth.

## 16. Scheduled and Background Jobs

Supabase Edge Functions currently present:

- `supabase/functions/tranche-deadline-check/index.ts`
- `supabase/functions/watchlist-reeval/index.ts`

### Tranche deadline check

Purpose:

- email users when tranche 2 deadline is approaching.

### Watchlist reevaluation

Purpose:

- email users when watchlist items are stale and need rescoring.

Required function-level secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`

URL/key scope note:

- `SUPABASE_URL` in Edge Functions is runtime-local env naming for server-to-server access.
- `NEXT_PUBLIC_SUPABASE_URL` is the app runtime env naming used by browser/server app clients.
- these commonly point to the same project base URL, but must not share privilege level because Edge Functions pair with `SUPABASE_SERVICE_ROLE_KEY`.

Deployment guidance exists in:

- `docs/deployment/vercel-production.md`

## 17. Secret Inventory

This is the complete current secret and config inventory relevant to rebuilding the platform.

### Browser and server app

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

### Server-side AI

- `AI_PROVIDER`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

### Server-side market data

- `POLYGON_API_KEY`

### Notifications and jobs

- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

### Secret retrieval sources

- Supabase dashboard project settings for URL and anon key
- Supabase service-role key from project API settings
- Polygon dashboard for `POLYGON_API_KEY`
- Google Generative Language / Gemini project for `GEMINI_API_KEY`
- Anthropic dashboard for `ANTHROPIC_API_KEY`
- Groq dashboard for `GROQ_API_KEY`
- Resend dashboard for `RESEND_API_KEY`
- deployment platform secret store for production runtime

## 18. Full Rebuild Sequence

To recreate the current platform with minimal guesswork:

1. create a Next.js 14 TypeScript App Router project,
2. install dependencies from `package.json`,
3. initialize Supabase and apply all current migrations,
4. configure `.env.local` with required variable names and real external values,
5. implement Supabase browser and server clients,
6. restore auth middleware and protected app context,
7. restore the app shell and mode selection behavior,
8. restore strategy-first storage and starter strategy seeding,
9. restore dashboard and unified portfolio analytics route,
10. restore MarketWatch feed routes and UI,
11. restore `/api/ai/assess`, `/api/ai/insight`, and `/api/ai/rate`,
12. restore new-trade wizard and trade detail management,
13. restore Strategy Studio and structure library editing,
14. restore portfolio reset and onboarding replay,
15. deploy Supabase Edge Functions and secret stores,
16. validate end-to-end login, MarketWatch scoring, deploy, analytics, and settings.

## 19. Validation Checklist

The rebuild is not complete until the following work:

- signup and login succeed,
- mode selection persists,
- strategy-first pages render without migration errors,
- MarketWatch loads live or fallback movers,
- preview drawer loads quotes and strategy options,
- strategy scoring persists to workbench,
- deploying from workbench creates a live trade,
- dashboard reflects the deployed trade,
- portfolio analytics refreshes active trades,
- trade journaling persists,
- settings reset behavior works,
- edge-function alerts can run with configured secrets,
- RLS policy verification passes for anon and authenticated sessions,
- reset-workspace destructive paths require intentional confirmation behavior,
- PWA service worker behavior is validated against auth logout/login and protected-route freshness.

## 20. Reliability and Hardening Addendum

This section captures implementation-critical risk surfaces so they are explicit in rebuilds.

### 20.1 AI provider routing and parsing

Current risk location:

- `lib/ai/provider.ts`
- `lib/ai/parser.ts`
- `/api/ai/assess`, `/api/ai/insight`, `/api/ai/rate`

Why it matters:

- three providers with different response and failure profiles route through one layer,
- parser is permissive,
- API returns explicit parse failures but without structured diagnostics for clients.

Hardening requirements:

- add schema-level response validation in each route,
- attach provider/model and parse-failure class to logs,
- return stable error codes for parse failures versus provider outages,
- add regression tests with malformed JSON payloads per provider.

### 20.2 Reset endpoint blast radius

Current risk location:

- `app/api/settings/reset-workspace/route.ts`

Why it matters:

- one endpoint can wipe major user state and optionally reseed.

Hardening requirements:

- require a second confirmation artifact for destructive scopes,
- log reset scope, user id, and result outcome for auditability,
- keep scope semantics (`activity` vs `full`) immutable and documented.

### 20.3 RLS and anon-key dependency

Current risk location:

- `supabase/migrations/005_rls_policies.sql`
- browser-exposed Supabase client usage (`lib/supabase/client.ts`)

Why it matters:

- anon-key exposure is normal; policy correctness is the true control plane.

Hardening requirements:

- add RLS integration tests for each primary table,
- validate cross-user denial for profiles, trades, watchlist, metrics, strategies, versions, and structure library,
- run RLS checks as part of rebuild verification, not only migration success.

### 20.4 Error boundaries and fallback behavior

Current implementation anchors:

- route-level: `app/loading.tsx`, `app/global-error.tsx`, `app/(app)/loading.tsx`, `app/(app)/error.tsx`
- shell-level suspense usage: `components/layout/AppShell.tsx`
- trade chart fallback: `components/trade/TradeDetailClient.tsx` clears candles/quote to safe empty state on fetch failure.

Hardening requirements:

- preserve visible fallback states for each critical async surface,
- avoid silent empty UI where a status message is more appropriate,
- document expected fallback UI per feature in release notes.

### 20.5 Analytics scope clarity

Current behavior:

- `calculateAnalytics()` and `calculateRealizedAnalytics()` are designed for closed-trade datasets.
- open-trade performance is handled separately in live portfolio views.

Hardening requirement:

- keep this closed-vs-open split explicit in docs and tests to avoid silently wrong aggregate metrics.

### 20.6 PWA and auth freshness

Current risk location:

- `next.config.mjs` with `next-pwa` enabled in production/CI contexts.

Hardening requirements:

- validate logout/login freshness under service worker,
- verify protected routes are not served stale after auth state changes,
- verify API route caching does not bypass permission expectations.