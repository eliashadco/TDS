# Lighthouse Audit Checklist (Step 19)

## Run
1. Build and start production app:
   - `npm run build`
   - `npm run start`
2. Audit key routes:
   - `/`
   - `/login`
   - `/dashboard`
   - `/trade/new`

## Target thresholds
- Performance >= 80
- Accessibility >= 90
- Best Practices >= 90
- SEO >= 90

## Remediation focus
- Ensure heading hierarchy and color contrast.
- Add descriptive labels and aria attributes for controls.
- Avoid layout shift on loading states.
- Keep JS payload bounded on dashboard/trade pages.
- Confirm metadata and social tags are present.
