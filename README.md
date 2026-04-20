# Intelligent Investors / TDS

Concise project brief for the current workspace.

## Product Summary

This app is a disciplined trading workflow platform for investors and active traders who want evidence, risk control, and structured execution instead of ad hoc decision-making.

The product combines market discovery, trade assessment, guided sizing, journaling, analytics, settings, and learn-mode explanations in a single workflow. The current implementation is branded as `Intelligent Investors`, while the underlying project shorthand and architecture history still refer to `TDS`.

## Core Product Decisions

These were recovered from the earlier project direction and remain the working rules unless the codebase deliberately evolves away from them:

- Never expose secrets in client components. AI, market-data, and privileged Supabase operations must stay behind server routes or server-side modules.
- Use server components for data loading and client components for interactivity.
- Use Tailwind utility classes rather than inline styles.
- Always provide loading and error states; do not leave empty or stalled screens.
- Direction awareness is mandatory. Labels, explanations, scoring, and AI prompts must reflect `LONG` versus `SHORT` context correctly.
- Conviction-based sizing is a guardrail, not a suggestion. The UI should not allow sizing below the enforced tier floor.
- Cache repeated AI responses and reusable market data where practical to avoid duplicate cost and latency.
- Debounce frequent free-text persistence to Supabase instead of writing on every keystroke.

## Current Workspace Snapshot

- Stack: Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase, Anthropic/Gemini/Groq provider support, Polygon market data, Resend notifications.
- App areas: dashboard, trade workflow, marketwatch, analytics, portfolio analytics, settings, onboarding, and authentication.
- API surface: `app/api/ai`, `app/api/market`, and `app/api/settings` hold server-side integration boundaries.
- Shared domain logic lives in `lib/ai`, `lib/market`, `lib/trading`, `lib/supabase`, `lib/validation`, and `types`.
- UI system is component-driven under `components`, with app shell, trade steps, analytics cards, onboarding flows, and learn-mode helpers separated by domain.

## Implementation Notes

The current codebase has evolved from the earliest scaffold brief in a few visible ways:

- Branding now uses `Intelligent Investors` in metadata and UI copy.
- Typography currently uses `Manrope` for interface text and `IBM Plex Mono` for numeric/data presentation.
- The active Tailwind `tds` palette is now light-first rather than the original dark-first brief.

These are not inconsistencies to “fix” automatically; they are the current product state for this workspace.

## Working Priorities

When changing this app, optimize for:

- Trustworthy trading workflows over decorative UI complexity.
- Clear risk communication and structured decision support.
- Fast, stable data refresh paths for marketwatch and analytics surfaces.
- Minimal duplication between API logic, prompt logic, and shared domain rules.
- Safe iteration after deployment through environment-driven configuration rather than code forks.

## Directory Landmarks

- `app/`: routes, layouts, loading boundaries, and API handlers.
- `components/`: reusable UI and feature-level client/server presentation components.
- `lib/`: shared business logic, AI providers, parsing, market integrations, caching, and validation.
- `supabase/`: migrations, config, and edge functions.
- `docs/deployment/`: production deployment and environment guidance.
- `docs/quality/`: audit and quality follow-up work.

## Local Workflow

```bash
npm install
npm run dev
```

Useful commands:

- `npm run dev:reset` resets the local dev environment before starting Next.js.
- `npm run build` verifies production build health.
- `npm run lint` runs the project linter.

## Deployment and Reference Docs

- Full platform architecture: `docs/architecture/full-platform-architecture.md`
- Architecture and replication: `docs/architecture/marketwatch-platform-architecture.md`
- Production deployment: `docs/deployment/vercel-production.md`
- Quality follow-up: `docs/quality/audit-remediation-plan.md`

If you need the short version: this repo is the implementation of a direction-aware, evidence-first trading operating system, with server-side integrations, guarded sizing logic, structured journaling, and a strong bias toward operational discipline over discretionary improvisation.
