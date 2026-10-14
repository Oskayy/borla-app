---
name: Trashit
description: Night-time refuse collection for Ghana. One structure, a shade of green per platform (chosen 14 Oct 2026).
colors:
  # Customers and the website (default, :root)
  canvas: "#f6f1e6"        # warm ivory
  surface: "#fffdf8"
  rail: "#efe8d9"
  ink: "#14201a"
  ink-2: "#3c4740"
  ink-3: "#5d675f"
  line: "#e6decd"
  line-strong: "#cfc5b1"
  action: "#9be07a"        # leaf: the main button, dark text on it
  on-action: "#0e1511"
  action-deep: "#2f7a3a"   # text-safe green
  action-wash: "#eaf5e1"
  hero: "#163320"          # forest: the one dark card per screen
  on-hero: "#ffffff"
  on-hero-2: "#bfd8c3"
  highlight: "#9be07a"
  selected: "#163320"      # selected tab, rail item, avatar
  # Drivers (.theme-driver): evergreen and clay
  driver-canvas: "#f3f6f3"
  driver-action: "#1e5a45"
  driver-hero: "#123a2e"
  driver-highlight: "#d9a06b"
  # Ops (.theme-ops): moss and sky
  ops-canvas: "#f5f7f2"
  ops-rail: "#ecf0e8"
  ops-action: "#3e6630"
  ops-hero: "#233a1e"
  ops-highlight: "#9cc9e4"
  # Status (same meaning everywhere)
  info: "#2a55a8"          # blue: waiting on Trashit
  warn: "#e0a23c"          # amber: on the way
  warn-deep: "#8a5300"
  ok: "#2f7a3a"            # green with a tick: done
  ok-deep: "#1d6a33"
  danger: "#b42318"        # red: needs someone
typography:
  family: "Geist, ui-sans-serif, system-ui, sans-serif"
  page-title: { fontSize: "clamp(1.75rem, 2.8vw, 2.25rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em" }
  hero-figure: { fontSize: "clamp(2.4rem, 4vw, 3rem)", fontWeight: 700, letterSpacing: "-0.035em", fontFeature: "tnum" }
  card-title: { fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.02em" }
  body: { fontSize: "15px", lineHeight: 1.6 }
  small: { fontSize: "13px" }
rounded:
  control: "14px"
  card: "22px"
  pill: "9999px"
elevation:
  card: "0 1px 2px rgb(20 32 26 / 0.04), 0 10px 28px -16px rgb(20 32 26 / 0.16), with a 1px line/70 ring"
  lift: "0 2px 6px rgb(20 32 26 / 0.07), 0 22px 44px -20px rgb(20 32 26 / 0.32)"
motion:
  ease-out: "cubic-bezier(0.2, 0.8, 0.2, 1)"
  spring: "cubic-bezier(0.3, 1.5, 0.5, 1)"
  max-duration: "400ms (fades only with reduced motion)"
---

# Design System: Trashit

## Overview

One product, three apps, one structure. Customers (and the website) are **clean green on warm ivory**, drivers are
**evergreen and clay**, ops is **moss and sky**. Each app has a light and a dark set. The approved reference is the
design canvas "Trashit Unified Design" (claude.ai artifact, pages Platforms and Website). Tokens live in
`app/globals.css`: `:root` (customer), `.theme-driver`, `.theme-ops`, each with `:root[data-theme="dark"]` overrides.
The retired role colours (`customer`, `driver`, `ops`, `night`) are aliases for screens not rebuilt yet; never use them
in new work.

## Colors

- **One main button per screen** in the platform's action colour (leaf with dark text for customers; evergreen or moss
  with white text for drivers and ops).
- **One dark hero card per screen** (`bg-hero`): what matters most right now (the pickup on its way, tonight's job,
  tonight's progress). It carries a slow glow in the platform's highlight (`hero-glow`).
- **Status colours mean the same everywhere** (`StatusTone` in `lib/order-status.ts`, `components/kit/Chip`):
  blue = waiting on Trashit, amber = on the way, green with a tick = done, red = needs someone. Never colour alone:
  chips always carry words.
- **Selected** state (tab, rail item, avatar) uses `bg-selected`, which stays visible in dark mode.
- All text pairs pass WCAG AA in all six sets (checked with a script over the tokens).

## Typography

Geist throughout. One page title style (`PAGE_TITLE` in `components/ui.tsx`), a small context line above it when the
page needs one (date and shift on ops), a short lead under it. Numbers in tables, prices and counts are tabular.

## Layout

- **Phones first** for customers and drivers: one column, a floating pill tab bar (`components/kit/TabBar`).
- **Computers**: customers and ops get an icon rail with hover names (`components/kit/IconRail`, ops' own `Rail` in
  `OpsShell`); drivers get pill tabs under a quiet header (avatar, vehicle and plate, theme).
- Every page starts with `PageHeader` (back link, context, title, lead, main action) and lines up on the same left
  edge. Content widths: forms and lists up to `max-w-4xl`/`5xl`; settings, profile and account pages use two columns
  on large screens; booking keeps a sticky summary beside the question.
- Empty lists use `EmptyState` (tinted icon, what will appear, the next step).

## Elevation & Depth

Content blocks are `CARD`: surface, soft shadow and a hairline ring. The hero card and main buttons use `shadow-lift`.
No hard offset shadows, no coloured side borders, no glass as decoration.

## Shapes

Pills for buttons, chips and tabs; 22 px cards; 14 px fields and inner tiles; 16–18 px rows inside cards.

## Components

- **Buttons** (`BUTTON_PRIMARY`, `BUTTON_QUIET`, `BUTTON_DANGER`): pills; disabled buttons turn grey (not faded colour).
- **Chips** (`components/kit/Chip`): status tones, a tick on "done".
- **HeroCard**, **StepTrack** (3 or 4 steps, light or on the hero), **Sheet** (native dialog, slides up),
  **Note** (confirmations), **Skeleton** (shimmer), **Map3D** (Mapbox Standard, tilted, day/night, drawn markers).
- **Fields**: `FIELD` / `AUTH_FIELD`, a green focus glow, errors under the field and in a summary at the top.

## Motion

Under 400 ms, transform and opacity, exponential ease-out: `anim-rise` (page entrance), `anim-stagger` (lists),
`anim-pop` (ticks, counts), `anim-note`, `lift` (rows that open something), `skeleton`, `hero-glow`, `dialog.sheet`.
With reduced motion everything becomes a short fade. Taps sink slightly (`.press`).

## Do's and Don'ts

- Do keep one title, one dark card and one main button per screen.
- Do say what happens next and when ("Put your bins out by 8pm").
- Don't use the retired role colours, unicode symbols as icons, eyebrow labels above titles, or same-size icon-card
  grids as page structure.
- Don't put the site footer inside the apps.
