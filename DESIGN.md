---
name: Trashit
description: Night-time refuse collection for Ghana. One type and component system, three role colours.
colors:
  night: "#0e1726"
  night-2: "#16233a"
  night-3: "#1f2f4a"
  night-line: "#2a3b58"
  night-ink: "#e8edf5"
  night-muted: "#a3b0c4"
  canvas: "#f4f6f5"
  surface: "#ffffff"
  ink: "#121a26"
  ink-2: "#3f4a5a"
  ink-3: "#5f6b7a"
  line: "#e2e6eb"
  line-strong: "#c9d0d8"
  customer: "#12825a"
  customer-deep: "#0b6646"
  customer-wash: "#e6f4ed"
  customer-glow: "#3fd99a"
  driver: "#f0a43a"
  driver-deep: "#9a5b06"
  driver-wash: "#fdf2df"
  ops: "#4b40e0"
  ops-deep: "#3a30c2"
  ops-wash: "#ecebfd"
  danger: "#b42318"
  danger-wash: "#fdecea"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 5.4vw, 4.1rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body-lead:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  numeric:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    fontFeature: "tnum"
rounded:
  inset: "8px"
  control: "10px"
  card: "14px"
  panel: "22px"
  band: "28px"
  pill: "9999px"
spacing:
  gutter: "16px"
  gutter-wide: "24px"
  stack: "16px"
  card: "28px"
  panel: "32px"
  section: "80px"
  section-wide: "96px"
components:
  button-customer:
    backgroundColor: "{colors.customer}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "48px"
  button-customer-hover:
    backgroundColor: "{colors.customer-deep}"
    textColor: "{colors.surface}"
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-quiet-hover:
    backgroundColor: "{colors.canvas}"
  button-night:
    backgroundColor: "{colors.night}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "48px"
  button-night-hover:
    backgroundColor: "{colors.night-3}"
  button-driver:
    backgroundColor: "{colors.driver}"
    textColor: "{colors.night}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "48px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  panel-night:
    backgroundColor: "{colors.night}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-night:
    backgroundColor: "{colors.night-2}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
---

# Design System: Trashit

## Overview

**Creative North Star: "One Night, Three Hands"**

Trashit is a single bin's night told in three colours. A customer pins a gate in green, a driver carries the load in amber across a night-navy city, and ops verifies the unload in indigo. Everything else is quiet: Geist set bold and tight for headlines, regular for reading, cool-grey daylight panels with hairline borders, and night navy for the shift itself. The colours are a legend, not a palette; wherever one appears, it says whose hand is on the job.

The system was built first on the public landing page (`/`) and sign-in (`/login`), which are the only surfaces where all three role colours meet. The customer, driver and ops apps will be rebuilt on these same tokens next. Each app takes one role colour as its lead and keeps the shared type, spacing, shapes and components; only the lead colour and the ground (light or night) change. Component specs for those apps that do not exist yet are marked *to be built* below, not invented.

Density is calm and generous on public surfaces (80 to 96px section rhythm, 6xl container) and is expected to tighten on ops desktop screens. Depth is mostly tonal (night against daylight, canvas against surface) with two soft shadows reserved for raised things. Motion is spent once per surface, on a single authored moment, and always has a reduced-motion fallback.

**Key Characteristics:**
- Three role colours (customer green, driver amber, ops indigo) that carry meaning, never decoration.
- Night navy grounds for the shift, the driver app and dark bands; white and cool-grey daylight for reading.
- One typeface, Geist, bold and tightly tracked for headlines, regular for body.
- Hairline rings and borders, softly rounded controls (10px) and cards (14px), large rounded panels (22px).
- Tabular numerals for every time and amount; amounts always written `GHS 50.00`.
- One authored motion moment per surface, shown complete under reduced motion.
- WCAG 2.2 AA: secondary text never lighter than ink-3 on white.

## Colors

A cool, near-neutral day and a deep blue-black night, with three saturated role colours that each come in four strengths: base, `-deep` (text-safe on light grounds), `-wash` (quiet tinted fill) and, for customer, `-glow` (the customer colour on night).

### Primary
- **Gate Green** (customer): the customer's colour and the public site's main call to action ("Book tonight's pickup"). Filled buttons with white text, check icons, the customer step of any timeline. Hover darkens to **Deep Gate Green** (customer-deep), which is also the shade for customer-coloured text and links on light grounds. **Gate Green Wash** (customer-wash) is the quiet fill for success notices, the households card and text selection. **Gate Green Glow** (customer-glow) is the only form of the customer colour used on night grounds (zone dots, the hero gate pin halo).

### Secondary
- **Lamp Amber** (driver): the driver's colour. On night grounds it is a fill (with night text, never white) and an icon or route colour. **Burnt Amber** (driver-deep) is the only amber allowed as text or as an icon on light grounds, where base amber fails contrast. **Amber Wash** (driver-wash) is the quiet fill behind driver icons on light grounds.

### Tertiary
- **Ledger Indigo** (ops): the operations colour: verification, planning, trust and checks. Icons for proof and trust, the verified-unload marker, the focus ring on every surface, and input focus borders. **Deep Indigo** (ops-deep) is for indigo text and links on light grounds ("Forgot password?"). **Indigo Wash** (ops-wash) is the quiet fill for ops and business panels.

### Neutral
- **Night Navy** (night): the shift. Footer, coverage band, driver card, hero route panel, the sign-in aside, and the neutral primary button on shared surfaces. **Night 2** and **Night 3** are raised layers on night (chips, cards on night; button hover). **Night Line** is the hairline on night. **Night Ink** is primary text on night; **Night Muted** is secondary text on night.
- **Daylight Canvas** (canvas): alternate section ground and the sign-in page ground; also quiet hover fill for ghost controls.
- **Paper White** (surface): reading surfaces, cards and inputs.
- **Ink** (ink): headlines and primary text. **Ink 2** (ink-2): body copy and labels. **Ink 3** (ink-3): the lightest permitted text on white (captions, times, placeholders, legal lines).
- **Hairline** (line): dividers and card rings. **Hairline Strong** (line-strong): input borders and the quiet button ring.
- **Alarm Red** (danger) with **Alarm Wash** (danger-wash): error text with an icon; wash for error fills. Not a role colour.

### Per-role application (for the apps being rebuilt)

| Role app | Ground | Lead colour (fills, primary action) | Text-safe shade | Quiet fill | Status |
|---|---|---|---|---|---|
| Customer (mobile-first) | light: surface on canvas | customer, white text | customer-deep | customer-wash | to be built on these tokens |
| Driver (mobile-first, outdoors at night) | dark: night, raised with night-2 / night-3, lines night-line | driver, **night** text | driver on night (driver-deep only if a light surface appears) | night-2 | to be built on these tokens |
| Ops (desktop, must work on a phone) | light: surface on canvas | ops, white text | ops-deep | ops-wash | to be built on these tokens |

The other two role colours still appear inside each app, but only to mean their role (for example, a driver's status inside the customer's order timeline is amber; a verified unload is indigo everywhere).

### Named Rules
**The Legend Rule.** Each role colour means its role and nothing else. Never use green, amber or indigo to decorate, to differentiate cards, or to add variety. If a colour cannot be read as "the customer", "the driver" or "ops / verification", it must be a neutral.

**The Deep-on-Day Rule.** On light grounds, role-coloured text and small icons use the `-deep` shade (or base customer/ops for icons only). Base amber is never text on a light ground.

**The Ink-3 Floor.** No text on white is lighter than ink-3. Grey placeholders like `#999` are banned.

**The Neutral Door Rule.** A surface shared by all three roles (sign-in, account choice) uses night as its primary button, not a role colour, and shows the three roles side by side as a legend.

## Typography

**Display Font:** Geist (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** Geist (same family)

**Character:** One grotesque for everything. Headlines are bold with tight negative tracking and balanced wrapping; body is regular with relaxed leading and pretty wrapping. Hierarchy comes from size, weight and tracking, never from a second family.

### Hierarchy
- **Display** (700, clamp(2.4rem, 5.4vw, 4.1rem), 1.02, -0.035em): the single hero headline per page.
- **Headline** (700, clamp(1.8rem, 3.4vw, 2.6rem), 1.25, -0.03em): section headings. Sign-in uses a 1.5rem bold variant for its form heading.
- **Title** (600, 1.125 to 1.25rem, tight tracking): card and step headings; large panel titles may go to 700 at 1.5 to 1.875rem.
- **Body lead** (400, 1.125rem, 1.625): the subline under a headline, max about 34rem.
- **Body** (400, 15px, 1.625): card and list copy, measure 30 to 65ch.
- **Label** (500 to 600, 0.875rem): nav links, form labels, buttons at small size, footer columns. Sentence case, no tracking change.
- **Numeric** (600, tabular figures): times ("8pm – 6am"), amounts, counts, codes.

### Named Rules
**The Geist-Only Rule.** Geist is the only typeface across the public site and all three apps. No display face, no mono, no system-font fallback styling.

**The Tabular Money Rule.** Every time, amount and count uses tabular numerals. Amounts are written `GHS 50.00`: currency code, a space, two decimals.

**The No-Kicker Rule.** Headings stand on their own. No eyebrow or kicker labels above headings (small uppercase category words). A short factual line under the heading is fine.

## Layout

A centred container of 72rem (Tailwind `max-w-6xl`) with a 16px side gutter on phones and 24px from 640px up. Sections stack with 80px vertical rhythm, 96px from 640px. Two-column compositions switch on at 1024px with asymmetric fractions (1fr / 1.05fr hero; 1.1fr / 1fr coverage; 1.25fr / 1fr audiences); below that, everything stacks in reading order. Three- and four-column grids appear at 768px. Grids of peer items use a 1px gap over the hairline colour inside one rounded ring, rather than separate floating cards.

Tap targets: primary buttons are 48px tall, nav buttons at least 44px, FAQ rows 56px. The sticky header is 64px with a translucent white ground and backdrop blur.

Ops density (desktop tables, boards) and the driver's one-handed mobile layout are *to be built*; they keep this container, gutter and target sizes as their floor.

## Elevation & Depth

Depth is primarily tonal: night against day, canvas against surface, night-2 and night-3 raised on night. Hairline rings (1px, line or night-line) define most edges. Two soft, cool shadows exist and are reserved for things that genuinely sit above the page.

### Shadow Vocabulary
- **Card** (`0 1px 2px rgb(18 26 38 / 0.04), 0 8px 24px -12px rgb(18 26 38 / 0.12)`): primary buttons, the active segment of a segmented control, small raised elements.
- **Lift** (`0 2px 4px rgb(18 26 38 / 0.06), 0 18px 40px -18px rgb(18 26 38 / 0.28)`): the hero night panel and its floating order card, the desktop sign-in shell.

### Named Rules
**The Ring-First Rule.** Cards and lists are defined by a hairline ring on a tonal ground. A shadow is added only when something floats over other content.

## Shapes

Softly rounded, never pill-shaped for actions. Controls (buttons, inputs, segmented controls) use 10px; the inner active segment uses 8px; cards and list items use 14px; large panels (hero night panel, coverage map, audience cards) use 22px; the full-width closing band uses 28px. Chips, zone tags and status pills are fully round. Icon tiles are circles (timeline steps) or 10px squares (workspace tiles). Lines in illustration are round-capped.

## Components

Character: confident, plain and tactile. Solid fills for the one action that matters, hairline rings for everything else.

### Buttons
- **Shape:** gently rounded (10px), 48px tall for primary actions, label weight 600 with a trailing arrow icon for forward actions.
- **Customer primary:** customer fill, white text, card shadow; hover to customer-deep. The default public call to action.
- **Quiet / secondary:** white with a line-strong ring, ink text; hover fills canvas. A role icon (driver-deep truck) may sit beside the words.
- **Night (neutral primary):** night fill, white text; hover night-3. Used on shared surfaces such as sign-in.
- **Driver on night:** driver fill with night text; hover brightens slightly. Only on night grounds.
- **On a role-coloured band:** white fill with the role's `-deep` text; hover fills the role's wash.
- **Disabled:** 60% opacity, not-allowed cursor; label changes to the progress verb ("Signing in…").
- **Focus:** the global focus ring (2px ops outline, 2px offset).
- **Ops primary:** *to be built* (expected: ops fill, white text, hover ops-deep, by analogy with customer).

### Chips
- **Style:** fully round. On day: canvas fill, ink-2 text, line ring, 12px semibold (payment providers). On night: night-2 fill, night-line ring, a small role dot before the label (zones). Status pill: role wash with `-deep` text, 11px semibold.
- **State:** chips are informational; no selected state exists yet.

### Cards / Containers
- **Corner Style:** 14px for cards and list items; 22px for feature panels.
- **Background:** surface on canvas, or a role wash with a 15% role ring for audience panels, or night for night panels.
- **Shadow Strategy:** ring-first (see Elevation); lift only on floating panels.
- **Border:** 1px ring in line (day) or night-line (night).
- **Internal Padding:** 20px for list items, 28px for cards, 32 to 40px for panels.

### Inputs / Fields
- **Style:** white fill, 1px line-strong border, 10px radius, 12px by 14px padding, 15px text in ink, placeholders in ink-3. Label above in 14px medium ink-2; helper links in ops-deep.
- **Focus:** border turns ops with a 3px ops ring at 15% opacity; caret is customer.
- **Error:** a danger line with an alert icon below the field, announced with `role="alert"`; success notices use customer-wash with customer-deep text and a check icon, `role="status"`.
- **Code entry:** 2FA code fields are centred, 1.5rem, wide letter-spacing, tabular numerals.

### Navigation
- **Public header:** sticky, 64px, white at 90% with backdrop blur and a hairline bottom border. Links 14px medium ink-2, hover ink; collapses to logo, Sign in and the primary button below 768px.
- **Segmented control (Sign in / Create account):** canvas track with 4px padding, active segment white with card shadow and ink text, inactive ink-3 with hover ink.
- **Footer (public):** night ground, night-muted links hovering to night-ink, column titles 14px semibold night-ink, hairline top rule on the copyright row.
- **App navigation** for customer, driver and ops: *to be built*.

### Night Timeline (signature)
Steps of the night laid on a 3px bar that blends customer to driver to ops (horizontal from 768px, vertical on phones). Each step has a 44px round icon tile in its role's wash with `-deep` icon, ringed in the section ground, a tabular time in ink-3, a title and body. The steps light up in order as they scroll into view.

### Night Route (signature)
A night-navy panel with a schematic street grid: a green gate pin, an amber driver route, an indigo verified-unload marker, text labels in night chips with role-coloured rings, and a floating white order card with a four-segment role-coloured progress bar. The route draws itself once on load.

### Role Legend (signature)
The three roles shown side by side, each with a filled role-colour icon tile (customer white icon, driver night icon, ops white icon) on night-2 cards. Used wherever all three roles meet (sign-in).

### Logo
The supplied Trashit logo (deep teal tile with an amber bin, "trashit" wordmark) is kept as is. Its teal and amber belong to the logo only and are not system colours; use the on-dark version on night grounds.

## Do's and Don'ts

### Do:
- **Do** let each app lead with its own role colour: customer green on light, driver amber on night navy, ops indigo on light.
- **Do** use the `-deep` shade for role-coloured text on light grounds and the `-wash` shade for quiet fills.
- **Do** put night text on amber fills.
- **Do** keep text at ink-3 (#5f6b7a) or darker on white, and use 44 to 48px tap targets.
- **Do** show status with an icon and words, never colour alone.
- **Do** use tabular numerals for times and money, and write amounts as `GHS 50.00`.
- **Do** spend motion on one authored moment per surface, eased with the expo-out curve, and show it complete under `prefers-reduced-motion`.
- **Do** keep the global 2px indigo focus ring visible on every interactive element.

### Don't:
- **Don't** use a role colour for decoration or variety; if it does not mean its role, use a neutral.
- **Don't** put base amber text on a light ground or white text on amber.
- **Don't** add eyebrow or kicker labels above headings.
- **Don't** introduce a second typeface.
- **Don't** use `#999`-style greys for text.
- **Don't** build new screens with the legacy classes `.btn-primary`, `.btn-accent`, `.panel`, `.input-field` or the legacy variables `--color-bg`, `--color-primary`, `--color-accent`, `--color-success`, `--color-border`, `--font-heading`, `--font-body`. They are deprecated, kept only so unrebuilt screens keep working, and are removed screen by screen as each app is rebuilt.
- **Don't** use the old teal `#0F3D3E` / amber `#E8A33D` palette outside the logo.
- **Don't** show invented figures, quotes or logos; proof slots stay hidden until real data exists.
