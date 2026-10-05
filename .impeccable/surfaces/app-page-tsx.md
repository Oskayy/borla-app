---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/login/page.tsx"]
---

# Landing page and sign-in (`/`, `/login`)

Mode: Persuade (landing), Operate (sign-in). Visitors: Accra/Tema households deciding whether to book tonight;
drivers deciding whether to sign up; staff signing in. Primary action: Book tonight's pickup (to sign-up/booking).
Secondary: Become a driver, Sign in. Pinned brief: the user's Figma (Oct 2026). Layout order from it: nav, hero,
one-night steps, proof strip (hidden until real figures), three reasons, live coverage, three audiences,
trust list (testimonial slot hidden until a real quote), FAQ, closing band, footer.

Proof rules: no invented figures or quotes. Coverage shows only active zones from the database.

## Direction contract

THESIS: One night, three hands. The page shows a single bin's night, from customer pin to driver pickup to verified
unload, with each role in its own colour. It refuses the category default of a stock-photo hero over three
identical feature cards.

OWN-WORLD: Night navy ink (#0E1726) for night scenes and the footer; clean white and cool-grey daylight panels for
reading. Three role colours carry meaning, never decoration: customer green, driver amber, ops indigo. Geist,
bold and tight for headlines, regular for body. Hairline borders, 12px radii, soft offset shadows.

STORY: Book by 6pm with an exact gate pin and MoMo; a nearby driver collects overnight with photo proof; the unload
is verified at a licensed site; you wake to a clear gate. Drivers and businesses each get a clear path in.

FIRST VIEWPORT: Left: headline "Your bin, cleared overnight." with a short subline, primary green "Book tonight's
pickup", quiet "Become a driver", three true facts below (book by 6pm, pay with MoMo, photo proof). Right, about
half the width: a night-navy animated scene of one pickup in five steps (open the app, book and pay, driver
assigned by dispatch, collected at the gate with a photo, unloaded at a licensed disposal site), with the customer's
phone showing each step and a step bar with pause.

FORM: Pinned (user Figma); the night-timeline steps replace four identical step cards. Seed: pinned, no roll.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md,
and every shipping raster carrying its provenance

Signature interaction: the hero flow plays the five steps on a loop (3.6s each): the phone screen changes, dispatch
signals the driver, the truck drives the amber route to the gate and on to the disposal site. Pausable; step
markers jump to a step. Reduced motion: no autoplay, the visitor steps through. The night-timeline steps light up
in sequence on scroll.
