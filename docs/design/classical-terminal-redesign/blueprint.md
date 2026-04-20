# Classical Terminal Redesign Blueprint

This is a second redesign direction for Intelligent Investors / TDS.

It is independent from the earth-retro concept and does not alter the platform implementation.

## Design Intent

Create a classical market-terminal-inspired interface for a strategy-first trading platform.

The influence is:

- institutional desktop terminals,
- market-professional information density,
- strict grid systems,
- compact controls,
- clear color semantics,
- modern implementation polish.

It should feel familiar to serious market users, but not like a direct clone of any specific vendor product.

## Core Rules

1. Dense does not mean cluttered.
2. Every page gets a primary grid and a single reading order.
3. Use color for market meaning, not decoration.
4. Prioritize speed of scan over visual softness.
5. Keep toolbars, filters, and numeric summaries consistent across pages.

## Visual Language

- Backgrounds: deep carbon and graphite
- Text: high-contrast warm white and pale gray
- Positive states: muted terminal green
- Negative states: burnished red
- Warning states: amber
- Accent states: electric desaturated blue
- Grid lines: thin, visible, deliberate

## Palette

- Carbon: `#111317`
- Graphite: `#171A1F`
- Slate: `#21262D`
- Grid Line: `#30353D`
- Soft White: `#E6E8EB`
- Dim Text: `#9CA4AF`
- Terminal Green: `#4FB381`
- Terminal Red: `#D9655D`
- Amber: `#C79A42`
- Signal Blue: `#69A2D7`
- Panel Edge: `#3A4049`

## Typography

Use a restrained, professional mix.

- Sans Headline: compact grotesk, semi-bold
- Sans UI: neutral operational sans
- Mono Numeric: critical values, tickets, timestamps, filters, axis labels

Suggested stacks:

- Sans: IBM Plex Sans, Geist Sans, Inter Tight, or similar
- Mono: IBM Plex Mono, Berkeley Mono, JetBrains Mono

## Layout Principles

Desktop base:

- full-width application shell
- compact left navigation rail
- dense top command bar
- primary content organized in strict columns and strips

Spacing scale:

- 8
- 12
- 16
- 20
- 24

Radius:

- minimal: `10` to `16`

## Page Model

### Dashboard

Purpose:

- front page for market state, portfolio state, and immediate actions

Structure:

- top metrics strip
- center-left active positions grid
- right ready board and alerts stack
- bottom quick context strip for strategy, heat, and workflow status

### Market Board

Purpose:

- scanning, ranking, and comparing names in a terminal-like environment

Structure:

- filter rail
- central table
- right instrument monitor

### Trade Blotter / Trade Studio

Purpose:

- structured trade entry with compact sequential sections

Structure:

- command bar
- thesis and assessment panes
- sizing and execution block
- confirm summary strip

### Analytics

Purpose:

- performance review for closed trades only

Structure:

- metrics strip
- chart zone
- attribution and lane breakdown tables

### Settings

Purpose:

- controlled operational configuration

Structure:

- profile and workspace panel
- strategy library table
- reset panel isolated separately

## Components

- Command Bar
- Terminal Metric Cell
- Positions Table Row
- Ticket Summary Card
- Alert Stack Card
- Filter Toggle Group
- Strategy Monitor Panel
- Dense Data Table
- Section Header with code-like metadata

## Interaction Rules

- hover states are crisp, not soft
- panels highlight with border contrast, not glow
- row selection uses a subtle blue or slate lift
- active trade direction colors remain readable on dark backgrounds
- use monospace in all high-frequency scan areas

## Figma File Structure

Pages:

1. `00 Cover`
2. `01 Foundation`
3. `02 Components`
4. `03 Dashboard Terminal`
5. `04 Market Board`
6. `05 Trade Blotter`
7. `06 Analytics Desk`
8. `07 Settings`
9. `08 Notes`

## Implementation Handoff Guidance

- preserve product routing and logic
- port layout structures before porting detailed skins
- keep one concept branch per redesign direction
- evaluate this concept primarily for information clarity and operator speed