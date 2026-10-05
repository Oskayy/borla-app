# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Customers**: households (and, planned, property managers and businesses) in Accra who want their refuse bins
  cleared overnight. They book and pay on their phones, usually in the evening before the 6pm planning snapshot,
  and check in the morning that the bin was collected.
- **Drivers**: Borla car and aboboyaa (tricycle) operators working the 8pm–6am night shift. They use a phone
  outdoors, in the dark, often a mid- or low-end Android on mobile data, with one hand while handling bins. Their
  jobs: go online, accept stops within the acceptance window, navigate to the customer's pin, photograph the pickup,
  unload at a disposal site, and withdraw earnings to mobile money.
- **Operations staff** (Super Admin, Ops Manager, Dispatcher, Finance, Support, Compliance, Analyst): plan tonight's
  routes, assign and reassign stops, approve drivers, review unloads and exceptions, and handle refunds and driver
  withdrawals. They work on laptops or desktops, with 2FA mandatory.

## Product Purpose

Trashit (repo name: borla-app; the product began as "Borla") is night-time refuse collection for Ghana. A customer
drops an exact pin, picks bin sizes, pays with mobile money, and the bins are collected that night and taken to a
disposal site, with photo and GPS proof at each step. Success: bins collected on the promised night, drivers paid
fairly and quickly, and ops able to see and fix any problem before morning.

## Positioning

Collection happens overnight, so streets are clear by morning. Every stop carries a chain of proof the customer can
see: an exact gate pin, a photo at pickup, and a geofenced unload at a licensed disposal site. Drivers are paid 40% at
pickup and 60% only when the unload is verified, so the incentive is to finish the job properly.

## Operating Context

- Market: **Ghana only**, starting in Accra. Currency **GHS** (cedis), timezone **Africa/Accra**, Ghana phone
  numbers, MoMo providers MTN, Telecel (VOD) and AirtelTigo (ATL). Any naira (₦) or Lagos text in design mockups is a
  placeholder to replace.
- Night rhythm: planning snapshot at 6pm, shift 8pm–6am, late orders accepted until the midnight cutoff,
  uncollected orders roll over at 6am. These are editable in the ops Shift Hours screen.
- Drivers must accept each assigned stop within `acceptMinutes` (default 15); declined or expired stops are reassigned
  automatically. Navigation opens Google Maps (or Waze) from the driver's live GPS to the customer's pin.
- Payments and payouts run through Paystack (MoMo charges, refunds, MoMo transfers). Alerts are in-app, Web Push,
  and SMS (Arkesel, currently parked).
- Device split: **customers and drivers are mobile-first**; the **ops console is designed for desktop** and must still
  work on a phone for urgent checks.

## Capabilities and Constraints

Built today (see CLAUDE.md for detail): booking with exact pin and server-side pricing (bin size × zone multiplier),
Paystack payment, order tracking, customer cancellation with refund, driver onboarding with document approval, go
online/offline, accept/decline with deadline and auto-reassign, pickup photo + GPS, trip unload with geofence and ops
review, driver earnings and MoMo withdrawals (24 h hold after a wallet change), ops planning board and assignment,
zones, pricing, payout rules, shift settings, vehicles, disposal sites, exceptions, refunds (second approver at
GHS 100+), withdrawals (second approver for manual payments), staff accounts, MFA recovery, notifications.

**Committed to build with the new frontend** (the user chose to build these, not only show them). Each needs its own
product decision before building, because most touch money or personal data:

- Customer (decided Oct 2026): PDF receipts, and privacy controls (export my data, delete my account) are approved
  for phase 2. Not now: saved MoMo wallets/cards, multiple properties. Not planned: Ghana Card checks for customers
  (no clear need; avoid collecting national ID) and a gender field (not needed by the service).
- Account deletion rules (decided Oct 2026): immediate, after a password re-check and typing DELETE; refused while a
  pickup is on its way or a refund is still processing. Orders, payments, refunds and ledger entries are kept for 6
  years for accounting but anonymised: name, phone, email, home pin, addresses, order pins and cancel notes are
  removed. The customer's own waste photos are deleted; driver pickup/unload proof is kept. The login is deleted.
  Customers can also download their data as a file. (Purging anonymised records after 6 years is still to be built.)
- Support contact: none yet. The "Need help?" panel stays hidden until a phone, WhatsApp or email is configured.
- Driver (decided Oct 2026): weekly shift availability that dispatch respects (the 6pm plan and auto-assign only use
  drivers available that night; exact rule to be confirmed before the planner changes); customer 1–5 star ratings with
  an optional comment on completed pickups, shown to the driver (average + recent) and to ops (low ratings);
  completion/acceptance analytics and missed-trip history from existing data; earnings statements as PDF and CSV
  ("for your records", not tax advice); a vehicle-type change sends the driver back for approval with new vehicle
  photos before the new capacity is used.
- Business: enterprise / property-manager accounts.
- Ops: financial analytics console, live fleet view, needs-attention queue.

Constraints: Next.js 16 App Router, React 19, Tailwind v4, Supabase (Postgres, Auth, Storage), Prisma. Prices and
payouts are always worked out on the server. Never trust amounts from the browser.

## Brand Commitments

- Name: **Trashit**. Logo and assets: `components/Logo.tsx`, `lib/brand.ts`, `public/brand/*`.
- Internal names kept on purpose: "Borla car" vehicle type, `borla-wd-` transfer references, `borla-dispatch-sweep` job.
- The user's Figma designs (Oct 2026) are the reference for the new frontend.
- **One design system, three role colours (user decision, binding):** customer, driver and ops apps share typography,
  spacing and component styles, but each role has its own distinct colour. The public landing page brings all three
  colours together. Working assignment: customer = green, driver = amber on night navy (dark UI, built for night
  use), ops = indigo. The old teal `#0F3D3E` / amber `#E8A33D` palette is being replaced.
- Landing-page proof slots (stats strip, testimonial) keep their place in the layout but stay hidden until real
  figures and real quotes exist.
- Voice: plain, friendly English; short sentences; says exactly what happens next and when ("Put your bins out by
  8pm"). Money amounts always shown as `GHS 50.00`.

## Evidence on Hand

- Real data: about 11 paid orders so far (average GHS 53), a handful of zones in Accra, a few test drivers. No
  production track record yet.
- Not available, and must not be invented: customer testimonials, on-time percentages, zone counts, "under 2 min"
  booking claims, partner logos, enterprise customers, press. The landing-page mockups contain such figures as
  placeholders only.
- Legal pages exist in `lib/legal-content.ts`; the Data Retention section is still a placeholder.

## Product Principles

1. **Proof over promises.** Every state a customer or ops sees is backed by a real event (payment, pin, photo, GPS,
   geofence), never a guess.
2. **Built for the night shift.** Driver screens work one-handed, outdoors, in the dark, on a weak phone and network.
3. **Money is never ambiguous.** Every amount says what it is, where it is going and when; uncertain results are shown
   as uncertain, never as failed or paid.
4. **Tell people what happens next.** Each screen ends with the next action and its deadline (cutoff, acceptance
   window, put-out time).
5. **Ops sees problems first.** Exceptions, unloads to check and approvals surface before routine data.

## Accessibility & Inclusion

- WCAG 2.2 AA. Known issues to fix: `#999` text fails contrast (use `#6B6B6B`); input borders `#8A8375`;
  visible `:focus-visible`; 44–48 px tap targets; real labels; `aria-live` for errors and success; status shown with
  icon + words, never colour alone.
- Low-end Android and slow mobile data: keep driver pages light; maps lazy-loaded.
- English UI; some users have limited reading confidence, so plain words and familiar MoMo terms.
