# Earth Retro Redesign Blueprint

This package is a separate redesign concept for Intelligent Investors / TDS.

It does not modify the platform implementation. It exists to define a clearer product expression before any app changes.

## Design Intent

Build a light, calm, page-specific interface for a strategy-first trading operating system.

The visual direction should feel like:

- institutional fintech clarity,
- disciplined trading tooling,
- retro editorial typography,
- modern spacing and interaction patterns,
- earthy, high-contrast surfaces for faster scanning.

The product should feel less like a terminal and more like an operating desk.

## Core Principles

1. One page, one job.
2. Avoid mixed-priority surfaces.
3. Keep primary decisions visible before secondary context.
4. Use contrast through tone and spacing, not clutter.
5. Treat risk, heat, and conviction as first-class navigation signals.

## Palette

Use these as the base Figma color styles.

- Bone: `#E8DECF`
- Sand: `#F5EEDF`
- Parchment: `#FBF6EE`
- Olive 700: `#58602A`
- Olive 500: `#6F7442`
- Moss: `#8D8F67`
- Umber: `#7D5236`
- Clay: `#9B6441`
- Amber: `#BE8A3A`
- Ink: `#201A13`
- Dust: `#A89C8A`
- Line: `#CFC1AE`
- Success: `#2F6C54`
- Danger: `#8B4330`

## Typography

Create these Figma text styles.

- Display Serif XL: editorial italic serif for page titles and signature hero statements
- Display Serif L: section titles
- Sans UI M: primary body copy
- Sans UI S: secondary body copy
- Mono Label S: uppercase metadata, chips, filters, tiny status text
- Mono Numeric L: PnL, heat, equity, position counts

Suggested families:

- Display: Canela, Ivar Display, Noe Display, or a similar sharp serif
- Sans: Manrope, Suisse Int'l, or a neutral grotesk
- Mono: IBM Plex Mono or JetBrains Mono

## Layout Model

Desktop frame width: `1440`

Base shell:

- left rail: `248`
- top utility bar: `76`
- content gutter: `32`
- card radius range: `24` to `34`
- vertical rhythm: `24`, `32`, `40`

## Page Frames

### 1. Dashboard

Purpose:

- immediate operating brief
- active exposure first
- ready trades second
- active positions and priorities below

Frame structure:

- row 1:
  - hero summary left, dominant
  - ready board right, narrow rail
- row 2:
  - active positions left
  - daily priorities right

Keep off the dashboard:

- full analytics detail
- full watchlist management
- strategy editing
- settings controls

### 2. MarketWatch

Purpose:

- qualify opportunities
- compare candidates
- move selected names into scoring or staging

Frame structure:

- column A: filters and mode context
- column B: movers/scored universe table
- column C: instrument detail and qualification drawer

### 3. Trade Studio

Purpose:

- one guided workflow from thesis to confirm

Frame structure:

- header with step progress
- thesis block
- assessment block
- sizing block
- confirm block

Use large, sequential sections rather than dense tabs.

### 4. Portfolio Analytics

Purpose:

- performance review only
- no trade-entry controls on this page

Frame structure:

- headline summary metrics
- equity and R-multiple charts
- lane breakdown
- closed-trade review table

### 5. Settings

Purpose:

- workspace configuration
- strategy library
- instructional controls
- reset and profile controls

Frame structure:

- left content stack
- one danger zone section isolated at bottom

## Components

Create these reusable Figma components.

- Left Rail Navigation
- Top Utility Bar
- Hero Summary Card
- Metric Capsule
- Priority Card
- Ready Board Card
- Data Table Row
- Strategy Lane Pill
- Status Chip
- Action Button Primary
- Action Button Secondary
- Filter Segment
- Section Panel

## Surface Rules

- Hero surfaces use dark olive gradients with white typography.
- Standard panels use parchment or sand backgrounds with ink text.
- Cards inside dark heroes should have a translucent warm-olive overlay.
- Use mono labels for tiny metadata and serif only for emphasis.
- Use one accent color per message type only.

## Motion

- no floating micro-animations
- page entry: slight upward fade, `180ms`
- panel entry: stagger, `60ms` intervals
- hover: small lift and contrast shift only
- drawers: horizontal slide with blur-backed overlay

## Figma File Structure

Pages:

1. `00 Cover`
2. `01 Foundations`
3. `02 Components`
4. `03 Dashboard`
5. `04 MarketWatch`
6. `05 Trade Studio`
7. `06 Portfolio Analytics`
8. `07 Settings`
9. `08 Notes`

## Handoff Guidance

- keep the redesign separate until approved
- migrate layout patterns before migrating fine-grain components
- preserve existing product logic and route responsibilities
- use this package as the visual source of truth, not as an implementation diff