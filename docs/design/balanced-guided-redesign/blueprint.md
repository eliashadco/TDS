# Balanced Guided Redesign Blueprint

This is the third redesign direction for Intelligent Investors / TDS.

It is separate from both previous concepts and does not change the platform implementation.

## Design Intent

Create a balanced interface that sits between the calm editorial earth-retro concept and the denser classical terminal concept.

The target feeling is:

- light but not fragile,
- structured but not overwhelming,
- modern but not generic,
- disciplined but beginner-friendly,
- closer to a guided investing workspace than a trading terminal.

## Product Translation

This design should help a newer user understand:

1. where they are,
2. what this page is for,
3. what matters most right now,
4. what they should do next.

## Core Rules

1. One page should emphasize one main job.
2. Every page should begin with a summary strip.
3. Use one strong primary action per section.
4. Explanatory copy should be short and visible.
5. Keep navigation persistent and calm.

## Visual Language

- overall tone: light neutral with balanced contrast
- cards: softly elevated but clearly bounded
- text: dark, crisp, readable
- accent palette: slate blue, ivory, cool stone, muted copper
- positive and negative states stay operational, not decorative

## Palette

- Mist: `#EEF3F7`
- Canvas: `#FCFBF8`
- Pale Stone: `#DEE6EC`
- Steel Line: `#C5D0DA`
- Slate Ink: `#162331`
- Soft Slate: `#4E6273`
- Slate Blue 700: `#274D67`
- Slate Blue 500: `#5E7F99`
- Powder Wash: `#E8EEF3`
- Muted Copper: `#B86F46`
- Positive: `#247457`
- Negative: `#AF4A3C`
- Focus Blue: `#3A6FA3`

## Typography

Use a friendlier, clearer mix than the terminal concept.

- Display Serif: page titles and key emphasis
- UI Sans: primary reading and controls
- Mono Small: metadata, pills, numbers, status chips

Suggested families:

- Serif: Cormorant Garamond, Iowan Old Style, or similar
- Sans: Manrope, IBM Plex Sans, or similar
- Mono: IBM Plex Mono

## Layout Model

Desktop shell:

- navigation rail on the left
- modest top summary bar
- content uses clear stacked sections with 2-column layouts only where needed

Grid behavior:

- wide pages should not exceed 2 major columns
- avoid more than 4 summary metrics in one row
- keep supporting content in a secondary rail when needed

## Page Model

### Dashboard

Purpose:

- calm overview with obvious next actions

Structure:

- row 1: page summary hero + guided next actions rail
- row 2: active positions + today focus

### MarketWatch

Purpose:

- discover and qualify names

Structure:

- left: filters and context
- center: candidate list
- right: explain-why drawer

### Trade Studio

Purpose:

- step through trade creation with confidence

Structure:

- progress header
- one major form section at a time
- right-side guidance panel

### Portfolio Analytics

Purpose:

- review performance with simplified narrative framing

Structure:

- summary strip
- charts on the left
- key takeaways on the right

### Settings

Purpose:

- configure workspace without operational noise

Structure:

- profile + preferences
- strategy library
- danger zone isolated below

## Component Set

- Navigation Rail
- Summary Hero
- Guided Action Rail
- Metric Card
- Instruction Card
- Priority Card
- Calm Data Row
- Step Progress Chip
- Drawer Panel
- Table Header Strip

## UX Notes

- beginner-facing explanatory text should be visible but compact
- tool names should be human-readable before they become system language
- use progressive disclosure for advanced information
- support confidence by showing “why this matters” under major summaries

## Figma File Structure

Pages:

1. `00 Cover`
2. `01 Foundations`
3. `02 Components`
4. `03 Dashboard`
5. `04 MarketWatch`
6. `05 Trade Studio`
7. `06 Analytics`
8. `07 Settings`
9. `08 Guidance Notes`

## Handoff Guidance

- port layout and hierarchy first
- preserve page responsibilities from the current product
- keep copy short and instructional
- use this concept when clarity and adoption matter more than information density