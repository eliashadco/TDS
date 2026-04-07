# TDS Production Deployment (Step 20)

## 1. Push to GitHub
- Ensure `npm run build` passes locally.
- Commit all changes and push to your `main` branch.

## 2. Connect to Vercel
- In Vercel dashboard: `Add New -> Project`.
- Import your GitHub repository.
- Framework preset: Next.js.

## 3. Configure Environment Variables
Set these in Vercel for Production:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_PROVIDER=anthropic`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL=claude-sonnet-4-20250514`
- `GROQ_API_KEY` (optional; mainly useful for Development/Preview)
- `GROQ_MODEL=llama-3.1-8b-instant`
- `GEMINI_API_KEY` (optional; useful for Development/Preview)
- `GEMINI_MODEL=gemini-2.0-flash`
- `POLYGON_API_KEY`
- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`

## Local AI Provider Switching
- Local development default: `AI_PROVIDER=gemini`.
- When Gemini returns an error, the server retries the same request on Groq if `GROQ_API_KEY` is configured.
- Anthropic remains available for later launch-stage use by setting `AI_PROVIDER=anthropic`.
- Force a provider without code edits by setting `AI_PROVIDER=groq`, `AI_PROVIDER=gemini`, or `AI_PROVIDER=anthropic` in `.env.local`.

## Groq Free-Tier Setup
- Create a Groq developer account and generate an API key.
- Put the key in `.env.local` as `GROQ_API_KEY=...`.
- Leave `AI_PROVIDER=auto` for automatic development routing, or set `AI_PROVIDER=groq` to force it.
- Start the app with `npm run dev:reset` after changing env vars.

## Groq Model Note
- Groq is not Grok. Grok models are from xAI and are not served through Groq.
- This app's Groq integration works with Groq-hosted chat models. Recommended default: `llama-3.1-8b-instant`.
- Stronger alternatives, subject to Groq account availability and limits: `llama-3.3-70b-versatile` and `deepseek-r1-distill-llama-70b`.

## Gemini Model Note
- This app's Gemini integration uses the Google Generative Language API.
- Recommended default for free-tier style development: `gemini-2.0-flash`.
- If Google changes model availability for your account or region, switch `GEMINI_MODEL` without code changes.

## 4. Create/Prepare Production Supabase
- Create project in Supabase dashboard.
- Copy URL/keys into Vercel env vars.

## 5. Run Migrations on Production
- `supabase link --project-ref <project-ref>`
- `supabase db push`
- Confirm the strategy tables from `supabase/migrations/010_first_class_strategies.sql` exist in Production:
  - `public.user_strategies`
  - `public.strategy_versions`
  - `strategy_id` columns on `user_metrics`, `trades`, and `watchlist_items`
- If strategy-first pages show a `Database Update Required` panel, Production is missing the first-class strategies migration and needs `supabase db push` rerun against the correct project.
- Store scheduler secrets in Supabase Vault for cron-triggered Edge Functions:
  - If the Vault extension is not enabled yet, use `create extension if not exists supabase_vault with schema vault;`
  - `select vault.create_secret('https://<project-ref>.supabase.co', 'tds_project_url');`
  - `select vault.create_secret('<service-role-key>', 'tds_service_role_key');`
- Deploy edge functions:
  - `supabase functions deploy tranche-deadline-check`
  - `supabase functions deploy watchlist-reeval`
- Set edge function secrets:
  - `supabase secrets set RESEND_API_KEY=... ALERT_FROM_EMAIL=...`

## 6. Configure Custom Domain
- Add domain in Vercel `Project -> Settings -> Domains`.
- Update DNS records as instructed by Vercel.

## 7. Verify End-to-End
- Auth signup/login.
- Trade wizard deploy.
- MarketWatch score/deploy.
- Analytics page renders.
- PWA installability checks:
  - `https://<domain>/manifest.json`
  - `https://<domain>/sw.js`

## 8. 30-Second Recording Checklist
- Open dashboard.
- Create/score a trade.
- Show analytics and settings.
- Show mobile "Add to Home Screen" option.
