# Balanced Guided Port Execution Checklist

Updated: 2026-04-16

This checklist turns the redesign audit into a gated execution plan tied to the actual route and component files in the app.

## Phase 1: Freeze The Reference Map

Gate to exit Phase 1:
- Every production surface is classified as either `exact prototype port`, `derived from prototype language`, or `supporting system surface`.
- Every route is mapped to its entry file and the component files that control the visible UI.
- Any surface without an exact balanced-guided reference is explicitly called out before implementation starts.

### Phase 1 Deliverables

- [x] Create route-to-reference matrix.
- [x] Identify exact-reference routes from `docs/design/balanced-guided-redesign/index.html`.
- [x] Identify derived surfaces with no exact prototype reference.
- [ ] Confirm whether trade detail, auth, drawer, selector, onboarding, and error states need new mocks or derived ports.

### Route-To-Reference Matrix

| Surface | URL / Role | Entry File(s) | Primary UI File(s) | Reference Type | Prototype Source |
| --- | --- | --- | --- | --- | --- |
| Shell | App-wide shell | `components/layout/AppShell.tsx` | `components/layout/NavBar.tsx`, `components/layout/TradeDrawer.tsx`, `components/layout/ModeSelector.tsx`, `app/globals.css` | Supporting system surface | `docs/design/balanced-guided-redesign/index.html`, `styles.css` |
| Dashboard | `/dashboard` | `app/(app)/dashboard/page.tsx` | `components/dashboard/DashboardClient.tsx`, `components/dashboard/ReadyTradesCard.tsx`, `components/dashboard/TodaysPrioritiesCard.tsx` | Exact prototype port | Dashboard section |
| Analytics Overview | `/portfolio-analytics` and `/analytics` redirect | `app/(app)/portfolio-analytics/page.tsx`, `app/(app)/analytics/page.tsx` | `components/analytics/PortfolioAnalyticsOverview.tsx`, `components/analytics/AnalyticsClient.tsx` | Exact prototype port | Analytics section |
| MarketWatch | `/portfolio-analytics?tab=marketwatch` and `/marketwatch` redirect | `app/(app)/portfolio-analytics/page.tsx`, `app/(app)/marketwatch/page.tsx` | `components/marketwatch/MarketWatchClient.tsx`, `components/marketwatch/MoversTable.tsx`, `components/marketwatch/ScoredList.tsx`, `components/marketwatch/InstrumentPreviewDrawer.tsx` | Exact prototype port with app-specific extensions | MarketWatch section |
| Trade Studio | `/trade/new` | `app/(app)/trade/new/page.tsx` | `components/trade/NewTradeClient.tsx`, `components/trade/ThesisStep.tsx`, `components/trade/AssessmentStep.tsx`, `components/trade/SizingStep.tsx`, `components/trade/ConfirmStep.tsx`, `components/trade/GuidedStructurePicker.tsx`, `components/trade/ScoreRow.tsx` | Exact prototype port | Trade Studio section |
| Trade Detail | `/trade/[id]` | `app/(app)/trade/[id]/page.tsx` | `components/trade/TradeDetailClient.tsx`, `components/trade/TradeReassessmentCard.tsx`, `components/trade/AssessmentMatrix.tsx`, `components/chart/PriceChart.tsx` | Derived from prototype language | No exact page in balanced-guided source |
| Archive | `/archive` | `app/(app)/archive/page.tsx` | route file controls page UI | Exact prototype port | Archive section |
| Settings Profile | `/settings/profile` | `app/(app)/settings/profile/page.tsx` | `components/settings/OnboardingRestartCard.tsx`, `components/settings/PortfolioResetCard.tsx`, `components/learn/LearnToggle.tsx` | Exact prototype port | Settings section |
| Settings Metrics | `/settings/metrics` | `app/(app)/settings/metrics/page.tsx` | `components/settings/MetricsEditorClient.tsx` | Exact prototype port | Settings section |
| Landing | `/` | `app/page.tsx` | `components/onboarding/LandingWalkthrough.tsx` | Derived from prototype language | No exact page in balanced-guided source |
| Auth Login | `/login` | `app/(auth)/login/page.tsx` | route file controls page UI | Derived from prototype language | No exact page in balanced-guided source |
| Auth Signup | `/signup` | `app/(auth)/signup/page.tsx` | route file controls page UI | Derived from prototype language | No exact page in balanced-guided source |
| Error States | global / auth / route errors | `app/global-error.tsx`, `app/(app)/error.tsx`, `app/(auth)/error.tsx` | route files control page UI | Derived from prototype language | No exact page in balanced-guided source |
| Workspace Setup Empty State | gated route fallback | `components/layout/WorkspaceSetupPanel.tsx` | shared panel | Derived from prototype language | No exact page in balanced-guided source |

### Derived Surface Approval Matrix

This matrix closes Step 1 by assigning a default derivation source for every non-prototype surface.

| Surface | Files | Recommended Derivation Source | Why This Is The Closest Fit | Approval Status |
| --- | --- | --- | --- | --- |
| Trade Detail | `app/(app)/trade/[id]/page.tsx`, `components/trade/TradeDetailClient.tsx`, `components/trade/TradeReassessmentCard.tsx`, `components/trade/AssessmentMatrix.tsx`, `components/chart/PriceChart.tsx` | Trade Studio shell + Archive detail rail + Analytics chart panel | Trade detail is a management/review page, not an entry form. It needs the guided structure of Trade Studio, the right-rail emphasis of Archive, and the chart framing of Analytics. | Recommended default |
| Landing | `app/page.tsx`, `components/onboarding/LandingWalkthrough.tsx` | Derived entry page using Summary Hero + Instruction Card + Priority Card language | The prototype does not include a marketing or unauthenticated landing page. The least risky option is a shellless entry page using the same type, spacing, and card grammar. | Recommended default |
| Login / Signup | `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx` | Landing-derived auth pattern using surface-panel + settings-detail card rhythm | Auth should not invent a new visual system. It should feel like a simplified balanced-guided entry checkpoint with one hero rail and one form surface. | Recommended default |
| Onboarding Walkthrough | `components/onboarding/LandingWalkthrough.tsx` | Trade Studio step flow + Settings side rail | The walkthrough is already a guided sequence. The closest balanced-guided analogue is the Trade Studio step experience with compact side guidance. | Recommended default |
| Mode Selector | `components/layout/ModeSelector.tsx` | Trade Studio progress / selection language inside a modal shell | Mode selection is a gating decision surface. It should feel like the first guided step of Trade Studio, not a separate product theme. | Recommended default |
| Trade Drawer | `components/layout/TradeDrawer.tsx` | MarketWatch explain-why drawer + calm data row list | The drawer is a system overlay for jumping between trades. The closest prototype behavior is the right-side contextual panel language from MarketWatch. | Recommended default |
| Workspace Setup / Empty State | `components/layout/WorkspaceSetupPanel.tsx` | Settings surface-panel + priority-card explanation block | This is a gated operational state. It should read like a calm system instruction page, not a bespoke hero. | Recommended default |
| Error States | `app/global-error.tsx`, `app/(app)/error.tsx`, `app/(auth)/error.tsx` | Workspace Setup empty-state pattern + danger-panel treatment | Errors are support states, not destination pages. They should inherit the balanced-guided instruction pattern with stronger alert tone. | Recommended default |

### Step 1 Decision

Default design-source decision for Step 1:

- Exact balanced-guided prototype is the source of truth for shell, dashboard, analytics, marketwatch, trade studio, archive, and settings.
- Trade detail, landing, auth, onboarding, drawer, mode selector, workspace-setup, and error states will be implemented as derived balanced-guided surfaces using the matrix above unless newer mocks are supplied.
- Pixel-perfect claims only apply to exact-reference routes. Derived routes can only be judged against approved derivation rules unless dedicated mocks are added later.

## Phase 2: Replace The Shell System

Gate to exit Phase 2:
- The app shell matches the balanced-guided prototype on desktop and mobile before any route-level parity signoff starts.
- No app-facing page is visually framed by the old `fin-shell` outer container.

### Shared System Files

#### `app/globals.css`
- [ ] Separate prototype primitives from legacy `fin-*` primitives.
- [ ] Stop using `fin-shell`, `fin-panel`, `fin-card`, and `fin-kicker` as the primary app design system.
- [ ] Move shell, page header, KPI, rail, table, and button rules under the balanced-guided system only.
- [ ] Add missing shared states for drawer, modal, empty states, and responsive shell behavior.

#### `components/layout/AppShell.tsx`
- [ ] Replace the inner `fin-shell` wrapper with the exact workspace frame used by the prototype.
- [ ] Match left rail spacing, content gutter, utility bar height, and mobile offsets.
- [ ] Remove layout padding decisions that only exist to support the old shell.

#### `components/layout/NavBar.tsx`
- [ ] Match exact desktop rail structure, spacing, hover states, and mobile rail behavior.
- [ ] Keep footer sign-out action identical to prototype placement and treatment.
- [ ] Verify active-state logic without changing prototype visual structure.

#### `components/layout/TradeDrawer.tsx`
- [ ] Rebuild as a balanced-guided drawer surface instead of a `fin-shell` overlay.
- [ ] Port filter pills, list rows, and empty/loading/error states into the new system.

#### `components/layout/ModeSelector.tsx`
- [ ] Rebuild the modal as a balanced-guided modal surface instead of `fin-shell` / `fin-card` tiles.
- [ ] Match typography, spacing, and action hierarchy to the prototype language.

#### `components/layout/WorkspaceSetupPanel.tsx`
- [ ] Convert gating/empty-state panel to balanced-guided language so setup-required pages do not regress visually.

## Phase 3: Port Exact-Reference Routes

Gate to exit Phase 3:
- Each route below visually matches the prototype structure and component hierarchy at desktop and mobile breakpoints.
- No route in this phase depends on `fin-*` primitives for its primary visible layout.

### `/dashboard`

Files:
- `app/(app)/dashboard/page.tsx`
- `components/dashboard/DashboardClient.tsx`
- `components/dashboard/ReadyTradesCard.tsx`
- `components/dashboard/TodaysPrioritiesCard.tsx`

Checklist:
- [ ] Replace remaining dashboard hero/action row with the prototype dashboard summary strip.
- [ ] Port overview panel to exact `dashboard-terminal-grid` structure.
- [ ] Port readiness monitor / guided actions rail to exact prototype hierarchy.
- [ ] Port active positions list to calm data row structure.
- [ ] Port today focus / priorities rail to prototype card structure.
- [ ] Remove remaining `fin-panel`, `fin-card`, `fin-kicker`, and ad hoc button styling from dashboard UI.

### `/portfolio-analytics`

Files:
- `app/(app)/portfolio-analytics/page.tsx`
- `components/analytics/PortfolioAnalyticsOverview.tsx`
- `components/analytics/AnalyticsClient.tsx`
- `app/(app)/analytics/page.tsx`

Checklist:
- [ ] Remove the old `fin-panel` workspace header currently wrapping the combined route.
- [ ] Split route visuals into the exact overview and analytics structures from the prototype.
- [ ] Port KPI strip to `analytics-kpi-card` primitives.
- [ ] Port chart panels and narrative takeaways to the exact analytics layout.
- [ ] Port source/setup/strategy insight cards to prototype structure.
- [ ] Keep current data behavior, but make layout and styling prototype-accurate.

### `/portfolio-analytics?tab=marketwatch`

Files:
- `app/(app)/portfolio-analytics/page.tsx`
- `app/(app)/marketwatch/page.tsx`
- `components/marketwatch/MarketWatchClient.tsx`
- `components/marketwatch/MoversTable.tsx`
- `components/marketwatch/ScoredList.tsx`
- `components/marketwatch/InstrumentPreviewDrawer.tsx`

Checklist:
- [ ] Remove any remaining legacy section framing and spacing that does not exist in the prototype.
- [ ] Match toolbar, segmented tabs, table rows, workbench, and watchlist geometry exactly.
- [ ] Decide whether the preview drawer is a derived extension or should be visually merged into the prototype’s explain-why panel language.
- [ ] Verify mobile stacking and import controls match prototype behavior.

### `/trade/new`

Files:
- `app/(app)/trade/new/page.tsx`
- `components/trade/NewTradeClient.tsx`
- `components/trade/ThesisStep.tsx`
- `components/trade/AssessmentStep.tsx`
- `components/trade/SizingStep.tsx`
- `components/trade/ConfirmStep.tsx`
- `components/trade/GuidedStructurePicker.tsx`
- `components/trade/ScoreRow.tsx`

Checklist:
- [ ] Replace the current fin-based header and KPI strip with the prototype trade-studio progress header.
- [ ] Port the major form surface to the exact `trade-form-shell` layout.
- [ ] Port each step body to the prototype `trade-step-body-grid` structure.
- [ ] Rebuild the guidance / summary rail to match the prototype right-hand guidance panel.
- [ ] Rebuild bottom navigation actions to prototype button placement and spacing.
- [ ] Keep the current product logic, but make the visual system identical to the prototype.

### `/archive`

Files:
- `app/(app)/archive/page.tsx`

Checklist:
- [ ] Finish exact archive header/filter/table/detail rail spacing.
- [ ] Verify empty state geometry and detail rail match the prototype exactly.
- [ ] Validate typography sizing against the prototype, not just class naming.

### `/settings/profile`

Files:
- `app/(app)/settings/profile/page.tsx`
- `components/settings/OnboardingRestartCard.tsx`
- `components/settings/PortfolioResetCard.tsx`
- `components/learn/LearnToggle.tsx`

Checklist:
- [ ] Keep the new structure, but align copy blocks, spacing, and information density exactly.
- [ ] Ensure onboarding, learning surface, and danger zone cards match the settings prototype sections.
- [ ] Rework `LearnToggle` visual treatment if it still reads as an old-system control.

### `/settings/metrics`

Files:
- `app/(app)/settings/metrics/page.tsx`
- `components/settings/MetricsEditorClient.tsx`

Checklist:
- [ ] Replace the remaining fin-based strategy studio layout with the exact settings page structure from the prototype.
- [ ] Port strategy library table to `terminal-table-shell` layout.
- [ ] Port AI + data rail to prototype right-side panel structure.
- [ ] Port risk controls and secondary settings cards to prototype settings-grid sections.
- [ ] Keep data entry behavior, but stop using the old design system for the visible frame.

## Phase 4: Port Derived Surfaces

Gate to exit Phase 4:
- Every surface without an exact balanced-guided reference has an approved derived layout using the same primitives and spacing scale as the prototype.

### `/trade/[id]`

Files:
- `app/(app)/trade/[id]/page.tsx`
- `components/trade/TradeDetailClient.tsx`
- `components/trade/TradeReassessmentCard.tsx`
- `components/trade/AssessmentMatrix.tsx`
- `components/chart/PriceChart.tsx`

Checklist:
- [ ] Create an approved derived design reference for trade detail.
- [ ] Rebuild the page using balanced-guided shell primitives only.
- [ ] Align chart, right rail, journal, and control states to the approved derived system.

### Landing / onboarding

Files:
- `app/page.tsx`
- `components/onboarding/LandingWalkthrough.tsx`

Checklist:
- [ ] Decide whether landing is out of scope for the authenticated product port or needs a derived balanced-guided marketing/entry page.
- [ ] Rebuild walkthrough surface using balanced-guided primitives if it stays in scope.

### Auth

Files:
- `app/(auth)/login/page.tsx`
- `app/(auth)/signup/page.tsx`

Checklist:
- [ ] Create approved derived auth mocks.
- [ ] Replace mixed `Card` + `fin-*` treatment with one balanced-guided auth pattern.

### Errors and support states

Files:
- `app/global-error.tsx`
- `app/(app)/error.tsx`
- `app/(auth)/error.tsx`

Checklist:
- [ ] Create approved derived error-state pattern.
- [ ] Remove remaining old-system framing from global/auth/section errors.

## Phase 5: Remove Legacy UI System

Gate to exit Phase 5:
- No primary route or shared UI surface depends on `fin-shell`, `fin-panel`, `fin-card`, or `fin-kicker`.

Checklist:
- [ ] Sweep route code for remaining `fin-*` usage.
- [ ] Sweep shared components for remaining `fin-*` usage.
- [ ] Remove or quarantine the old primitives from `app/globals.css`.

## Phase 6: Validation And Signoff

Gate to exit Phase 6:
- Desktop and mobile route comparisons pass.
- Build and lint are green, except for any explicitly accepted unrelated debt.

Checklist:
- [ ] Verify desktop parity for shell, dashboard, marketwatch, analytics, trade studio, archive, settings.
- [ ] Verify mobile parity for shell, marketwatch, archive, settings, and modal/drawer states.
- [ ] Run build and lint after route ports complete.
- [ ] Resolve current unrelated lint debt before final signoff:
  - `components/dashboard/DashboardClient.tsx`
  - `components/marketwatch/MarketWatchClient.tsx`

## Step 1 Start Status

Step 1 has started with this document.

Completed in Step 1 so far:
- route inventory
- reference classification
- file ownership map

Remaining to finish Step 1:
- none, if the recommended default derivation matrix above is accepted as the implementation rule