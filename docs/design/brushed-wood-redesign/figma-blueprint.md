# Brushed Wood Redesign Blueprint

This package is a separate light-theme redesign concept for Intelligent Investors / TDS.

It exists to define a warmer product expression before any platform implementation work begins.

## Design Intent

Build a tactile trading workspace that feels closer to a wooden strategy desk than a clinical terminal.

The visual direction should feel like:

- warm and grounded,
## Core Rules

1. Use warmth and materiality to reduce the sterile fintech feel.
2. Keep operational hierarchy sharper than the decorative layer.
3. Reserve copper accents for committed actions and key highlights.
## Palette

## Texture Guidance

The brushed wood effect should come from a restrained grain texture, not a photo-real background.

- use a low-opacity SVG turbulence layer,

- Sanded Birch: `#FDF8F0`
- Muted Oak: `#EEE9E0`
- Weathered Grain: `#B8A38E`
- Aged Timber: `#3B3128`
- Deep Walnut: `#2A1F18`
- Muted Copper: `#B45309`
- Copper Glow: `#D97706`
- Forest Ledger: `#45624B`
- Moss Shade: `#6F7C65`
- Clay Note: `#C97B4A`
- Paper Highlight: `#FFFDF8`
- Ink Soft: `#6E6255`
- Danger Brick: `#9C4A32`
- Success Pine: `#35614B`

## Material System

Treat the interface as three materials:

- desk: warm wood base with subtle grain and broad tonal movement,
- paper: brighter, softer cards that sit above the desk,
- hardware: sharper copper and Deep Walnut details for rails, headers, and status points.

## Typography

Create these Figma text styles.

- Display Serif XL: page titles, hero headings, strategic framing
- Display Serif M: section headings, major card titles
- Sans UI M: body copy and supporting explanation
- Sans UI S: compact guidance and table support text
- Mono Label S: chips, filters, navigation labels, compact status text
- Mono Numeric L: equity, heat, PnL, tranche, and risk values

Suggested families:

- Display Serif: Iowan Old Style, Georgia, or Canela-style serif
- Sans: Inter, Manrope, or IBM Plex Sans
- Mono: IBM Plex Mono

## Texture Guidance

The brushed wood effect should come from a directional grain texture.

- use a low-opacity SVG turbulence layer with a 2:1 aspect ratio to simulate horizontal grain,
- keep the grain directional and subtle,
- avoid visible repeating seams,
- do not let the texture reduce data readability,
- use paper-like inner cards to keep text contrast high.

## Layout Model

Desktop frame width: `1440`

Base shell:

- left rail: `252`
- top utility bar: `76`
- content gutter: `32`
- card radius range: `22` to `32`
- section spacing: `24`, `32`, `40`

## Page Frames

### 1. Dashboard

Purpose:

- daily operating brief,
- risk and readiness first,
- calm high-signal review surface.

Structure:

- hero overview left,
- readiness and execution ledger right,
- active positions below,
- notes and priorities as a paper-stack rail.

### 2. MarketWatch

Purpose:

- compare candidates,
- promote only qualified names,
- keep context beside the table instead of buried under it.

Structure:

- filter ledger left,
- candidate table center,
- qualification and instrument notes right.

### 3. Trade Studio

Purpose:

- one deliberate flow from thesis to confirmation,
- reinforce pacing and mechanical discipline.

Structure:

- progress header,
- one main active step,
- right-side notes panel styled like a clipped paper briefing.

### 4. Portfolio Analytics

Purpose:

- review results,
- spot heat and consistency,
- explain what changed, not just what moved.

Structure:

- summary strip,
- primary chart surface,
- key takeaways rail,
- trade review ledger.

### 5. Settings

Purpose:

- workspace setup,
- strategy versioning,
- instructional preferences,
- isolated danger controls.

Structure:

- profile and preferences first,
- strategy library middle,
- danger zone last.

## Components

Create these reusable Figma components.

- Navigation Rail
- Top Utility Bar
- Desk Hero Card
- Paper Surface Panel
- Ledger Metric Capsule
- Strategy Anchor Plate
- Readiness Stack Card
- Action Button Primary
- Action Button Secondary
- Filter Tab Strip
- Position Ledger Row
- Note Card
- Status Chip

## Motion

- page entry: soft upward fade, `180ms`
- card entry: staggered `50ms`
- hover: subtle lift and contrast shift only
- no continuous ambient motion
- theme toggle should feel like changing the room light, not flipping a neon switch

## Figma File Structure

Pages:

1. `00 Cover`
2. `01 Foundations`
3. `02 Materials & Texture`
4. `03 Components`
5. `04 Dashboard`
6. `05 MarketWatch`
7. `06 Trade Studio`
8. `07 Portfolio Analytics`
9. `08 Settings`
10. `09 Implementation Notes`

## Implementation Mapping Notes

When this concept is approved, map it to the existing application through:

- `--v2-surface`: `#FDF8F0`
- `--v2-sub-surface`: `#EEE9E0`
- `--v2-sidebar`: `#2A1F18`
- `--v2-border`: `#B8A38E`
- `--v2-text`: `#3B3128`
- `--v2-accent`: `#B45309`

Apply the grain as a low-opacity body overlay and keep component surfaces lighter than the desk background.

## Handoff Guidance

- keep this redesign separate until approved,
- validate hierarchy before tuning texture intensity,
- port shell and panel patterns before component polish,
- preserve current route responsibilities and workflow logic,
- treat this package as the visual source of truth for the Brushed Wood concept.