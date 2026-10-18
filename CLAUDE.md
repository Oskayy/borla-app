@AGENTS.md

# Trashit (repo: borla-app)

Night-time refuse collection for Ghana. One Next.js app serves three roles: customers book and pay,
drivers (Borla cars, aboboyaa tricycles) collect and unload at disposal sites, ops plan, assign and
handle money and exceptions. The project began as "Borla"; the product is now **Trashit**.

## Hard rules (never break)

- **Never run `prisma migrate dev`, `prisma migrate reset` or `prisma db push` against the live database.**
  Write migration SQL by hand in a new `prisma/migrations/<timestamp>_<name>/migration.sql`, then
  `npx prisma migrate deploy` and `npx prisma generate`. To see what SQL is needed (prints only):
  `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
- **Never read, print or edit `.env`**, and never put secret values in code, commits, logs or chat.
  Variable names are listed below; values live in `.env` and the host's settings.
- **Never send real money in tests.** Use Paystack test keys and a staging Supabase project.
- Ask before: pushing to GitHub, deleting files, changing money logic, or anything touching production.
- Line endings: `.ts`/`.tsx` files use **CRLF**; `schema.prisma` and `.sql` files use **LF**. Keep what a file already uses.
- Next.js 16 differs from older versions (see AGENTS.md): route files export only HTTP handlers,
  `params` is a Promise, `proxy.ts` is the middleware. Check `node_modules/next/dist/docs/` before guessing.
- Before calling work done: `npm run build` passes (it runs `prisma generate` + `next build`), `npm run lint` and `npm test`.
  `TEST_BASE_URL=http://localhost:3000 npm test` also checks every API route refuses signed-out callers.
  `npm run test:a11y` (Playwright + axe-core, e2e/) checks the main pages in light and dark mode for serious WCAG 2.2 AA
  problems; most reliable with the dev server already running and `TEST_BASE_URL` set to it.

## Business rules (placeholders are editable in the ops screens)

- Timezone **Africa/Accra**, same for all zones. Shift **8pm–6am**; planning snapshot **7pm** (live setting since 28 Sep; code default 6pm);
  late orders accepted until the **midnight** hard cutoff. Settings: `OperatingSettings` table, ops page Shift Hours.
- Zones are **outlines** drawn on the map (`Zone.boundary`, GeoJSON; `lib/zone-shape.ts`), since 18 Oct 2026 (the old circles were
  converted to 32-sided outlines just outside them). An address belongs to the zone whose outline contains it
  (`lib/zone-match.ts`); zones can't overlap (checked on save, in a Serializable transaction, `lib/zone-save-server.ts`), saving
  moves affected customers and is logged (`ZONE_CREATED/CHANGED/DELETED`). Only Super Admin and Ops Manager change zones
  (`ZONE_EDIT_ROLES`); `Zone.tier` (premium/standard/basic) sets the price of zones that follow it (see Price below). Zones are drawn on a
  satellite map on the Zones page (Mapbox GL Draw, `components/ops/ZoneDrawMap.tsx`): overlaps show red with "Trim to fit"
  (`trimToFit`), and a dry run (`?dryRun=1`) shows how many customers a save moves. "Suggest zones" (`lib/zone-suggest*.ts`, `/api/admin/zones/suggest`, max
  150 km², 10 scans an hour) proposes one zone per OpenStreetMap neighbourhood (or a grid) away from existing zones, with a
  tier from the share of buildings with a pool, building density and our order values; one Overpass request per scan
  (often 30-90 s, cached a day). Nothing is saved until a person reviews it in the zone form.
- Price = base by bin size (30/60/120 L, placeholders) x **per-zone multiplier**. Since 19 Oct 2026 the multiplier is either
  the zone's **tier price** (`TierPrice` table, Pricing page, all 1.0 for now; `Zone.followsTier`, new zones follow) or its
  **own price** (all zones from before 19 Oct). Only Super Admin and Finance change either (`lib/tier-price*.ts`); saving a
  tier price updates every zone following it in one transaction, logged `TIER_PRICES_CHANGED`. A tier change that would
  change a zone's price needs a Super Admin (Ops Managers are refused). Customers must drop an exact
  pin (`locationSource` `home_pin` or `pin`); the price is worked out on the server, never trusted from the browser.
- Platform fee is taken off the top; the **driver pool** is paid **40% at pickup, 60% at disposal**
  (disposal released by the site geofence, or by ops review on "Unloads to Check"). `PayoutRule` table.
  The split is **frozen on the order at payment** in whole pesewas and basis points, remainder last (`lib/money-split.ts`).
- Driver earnings **clear 24 h** after the later of unload and shift end, unless a complaint or refund is open; pickup
  shares wait for the unload; new drivers keep a small reserve (`lib/earnings.ts`). Refunds with **driver fault** claw back
  their shares; customer-fault failed pickups keep an **attempt fee of 0-25%** (Pricing page, `attemptFeePercent`; **0% since 13 Oct
  2026**, so a full refund), partly paid to the driver; the rest is always refunded and ops "Close" only works once
  nothing is left to refund. Trashit absorbs
  Paystack's 1.95%.
- Every morning (Accra): **7am** reconciliation of yesterday + Paystack top-up check; from **10am** the daily payout sweep
  (automatic up to GHS 1,000, minimum GHS 20, only when the Paystack balance covers it all). "Cash out now": first one
  free each day, then GHS 1; instant up to GHS 500 (`lib/treasury.ts`). All placeholders.
- Money safeguards: replacing a driver's MoMo wallet needs the password again and **pauses withdrawals 24 h**
  (`PAYOUT_CHANGE_HOLD_HOURS`, `lib/wallet.ts`). Manual "mark paid" withdrawals wait in `CONFIRMING` until a
  **different** finance user confirms. Staff refunds of **GHS 100+** (`REFUND_APPROVAL_THRESHOLD_GHS`, placeholder,
  `lib/refunds.ts`) wait in `AWAITING_APPROVAL` for a different staff member; customer self-cancellations don't.
- Pickup checks (`lib/plausibility.ts`) flag, never block: no/weak GPS, photo far from the pin, impossible speed
  between pickups, the same photo reused. They appear on the Exceptions page.
- Capacity-based dispatch: drivers make **multiple trips per night** (`maxTripsPerNight`), each trip ends at a disposal site.
- Drivers must **accept** each assigned stop within `acceptMinutes` (default 15); declined or expired stops are
  **reassigned automatically** (`lib/reassign-server.ts`); a decliner is never offered that order again.
- At 6am, uncollected orders **roll over** to the next night.
- Navigation uses Google Maps links from the driver's **live GPS** to the customer's pin (`lib/navigation.ts`).

## How it is built

- Next.js 16.3.6 (Turbopack), React 19, Tailwind v4 (barely used yet; most styling is inline + `app/globals.css`).
- Prisma 6.19 on **Supabase Postgres** (RLS on; the app's Prisma connection bypasses RLS, so every API route
  must check who the caller is and what they own). Supabase Auth (staff 2FA), Supabase Storage buckets:
  `pickup-evidence` (private), `vehicle-images` (public), `driver-documents` (private). Private files are shown via 30-minute signed URLs.
- **Paystack**: payments (`/api/payments/initialize`, `/api/payments/webhook` with HMAC-SHA512 check),
  refunds, MoMo transfers for driver withdrawals (references `borla-wd-<uuid>`). `lib/paystack.ts` returns
  `{ok, data, error, uncertain, httpStatus}`; an uncertain result never marks money failed:
  withdrawals stay PROCESSING (ops "Check" action), refunds go to NEEDS_ATTENTION.
- **Scheduler**: Supabase pg_cron job `borla-dispatch-sweep` calls `/api/cron/dispatch` every 2 min with
  `Authorization: Bearer CRON_SECRET`. `lib/nightly-jobs.ts` runs snapshot / shift start / rollover once per
  night using `JobRun` rows as locks (`snapshot:<date>`, `shiftstart:<date>`, `rollover:<date>`).
- Alerts: in-app `Notification` table + Web Push (`web-push`, VAPID keys, `public/sw.js`) + **Arkesel SMS** (`lib/sms.ts`).
- Maps: Mapbox GL in the app; Google Maps links for turn-by-turn.
- Brand: `lib/brand.ts`, `components/Logo.tsx`, `public/brand/*` (logo and launch animation are being redesigned; old files until then).
- Design system (14 Oct 2026, design canvas "Trashit Unified Design"): one structure, a green per platform. Tokens in
  `app/globals.css`: customers and website on `:root` (leaf `#9BE07A` buttons, forest `#163320` hero, ivory `#F6F1E6`),
  `.theme-driver` (evergreen `#1E5A45`, clay `#D9A06B`), `.theme-ops` (moss `#3E6630`, sky `#9CC9E4`), each with a dark set.
  Status colours: blue waiting on Trashit, amber on the way, green with a tick done, red needs someone (`StatusTone` in
  `lib/order-status.ts`). The old role colours (`customer`, `driver`, `ops`, `night`) are aliases kept for screens not
  rebuilt yet; don't use them in new work. Shared pieces: `components/kit/*` (Chip, HeroCard, StepTrack, TabBar,
  IconRail, Sheet, Note, Skeleton) and `components/ui.tsx` (buttons, fields). Motion classes (`anim-rise`, `anim-stagger`,
  `lift`, `skeleton`, `hero-glow`, `dialog.sheet`) stay under 400 ms and fade only with reduced motion.
  Internal names kept on purpose: "Borla car" vehicle type, `borla-wd-` references, `borla-dispatch-sweep` job.

### Where things live

- Roles: `CUSTOMER`, `DRIVER`, `SUPER_ADMIN`, `OPS_MANAGER`, `DISPATCHER`, `FINANCE`, `SUPPORT`, `COMPLIANCE`, `ANALYST`.
  Auth check: `requireAuth([...roles])` in `lib/auth.ts` (also blocks deactivated users).
- Customer pages `app/dashboard/customer/*`, driver pages `app/dashboard/driver/*`, ops pages `app/ops/*`, APIs `app/api/*`.
- Dispatch/planning: `lib/planner.ts`, `lib/dispatch*.ts`, `lib/schedule.ts`, `lib/shift.ts`, `components/PlanBoard.tsx`.
- Money: **double-entry ledger** (`Journal`/`Posting`, `lib/accounts.ts`, `lib/journal-server.ts`). Every money event is
  a balanced journal written in the same transaction as the change; the database refuses unbalanced journals and any
  update or delete (fix mistakes with a correcting journal). `LedgerEntry` stays as the operational record that driver
  wallets read (`lib/wallet-server.ts` + `lib/earnings.ts`); the daily check compares the two. Payouts:
  `lib/payouts-server.ts`; treasury and sweep: `lib/treasury*.ts`; reconciliation: `lib/reconcile*.ts`; Finance page
  `/ops/finance`. Also `lib/refunds*.ts`, `lib/paystack.ts`. Money writes use Serializable transactions and idempotency keys.
- Rate limiting: `lib/rate-limit.ts` (login, signup, reset, withdrawals and others).

### Environment variable names (values are in `.env`, never read it)

`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `ARKESEL_API_KEY`, `SMS_SENDER_ID`,
`NEXT_PUBLIC_OAUTH_PROVIDERS` (not a secret: which "Continue with …" buttons show, e.g. `google`; empty = none).

## Open work (as of 13 Oct 2026)

**State (checked 13 Oct 2026):** all migrations applied (latest `20261019120000_tier_prices`, applied 19 Oct); build, lint and tests
pass; work committed and pushed. The payment flow rewrite (steps 2–7) is live. Paystack is still in **test mode**.
The local `.env` and Vercel both use the new `sb_secret_` Supabase key. The database pooler sometimes drops a connection
for a few seconds: if a migration or script says "Can't reach database server", wait and run it again.

**Paystack and payouts:**
- The account is a **Starter Business**, which Paystack won't let send third-party payouts ("You cannot initiate third
  party payouts as a starter business"). Upgrade to a **Registered Business** (Settings → Business/Compliance), then
  turn off "Confirm transfers before sending" (OTP) in Preferences → Transfers, then switch **Paystack transfers** on
  (Finance page). Until then the switch is **off**: the 10am payout and Cash out now wait on the Withdrawals page and
  Finance pays by hand (Mark paid; a second Finance user confirms; there are now two).
- **Going live:** put the live Paystack keys on Vercel, point Paystack's live webhook at `/api/payments/webhook`, record
  the live Paystack balance as an **opening balance** on the Finance page, and turn OTP off in Live mode too. The test
  balance (GHS 1,521.47) was recorded as an opening balance on 11 Oct.

**Money decisions still with Collins (all placeholders work at 0 or their defaults):**
- **Tax:** VAT, NHIL, GETFund and withholding on driver pay are all 0% (Pricing page). Needs the accountant: the rates,
  whether VAT is charged on the price plus the levies (the app charges each on the price), and whether withholding applies.
- **Disposal site tipping fees:** the field exists (all GHS 0) but drivers aren't reimbursed yet; build it once decided.
- Placeholders worth reviewing with real data: platform fee 15%, payout rule (40/60, surcharges 100% to drivers,
  Trashit absorbs 100% of the recyclable discount, distance bonus GHS 1/km beyond 3 km, max GHS 10), clearing 24 h,
  new-driver reserve, sweep and cash-out limits (`lib/treasury.ts`), attempt fee 25%, refund approval GHS 100.

**Drivers:**
- All four approved drivers have **no Ghana Card number**. Their old card photos were deleted on 12 Oct, so ask the
  drivers for the numbers and enter them on the ops Drivers page (Add number).
- The test driver account must never be approved (dispatch would send it real orders).

**Sign in with Google (built 14 Oct 2026, not switched on yet):** `lib/oauth.ts`, `components/auth/SocialSignIn.tsx`; new
accounts finish on `/signup/finish` (role, phone, age) via `/api/auth/complete-signup`; staff still enter their 2FA code.
To switch on: Google Cloud OAuth client (redirect URI `https://<project>.supabase.co/auth/v1/callback`), then Supabase →
Authentication → Providers → Google, then `NEXT_PUBLIC_OAUTH_PROVIDERS=google` in `.env` and on Vercel. Apple, Microsoft
(`azure`) and Facebook work the same way. Turn email confirmation on before launch: with it off, someone could register a
password account on another person's Gmail address before they first use Google.

**Parked: Arkesel SMS.** `ARKESEL_API_KEY` and `SMS_SENDER_ID` are not set, on purpose. The app runs without them (SMS
skipped, one `[sms] SMS is off` warning; in-app and push alerts still go out). Needed before launch and before security
fix F1 (which texts the old MoMo number). Email confirmation is deliberately **off** while testing with made-up emails.

**Staging Supabase project (not created yet):** needed for `tests/security/cross-account.test.ts` (two test customers
and a driver) and for an end-to-end stress test (real accounts, bookings, payments and the dispatch sweep). The
dispatch stress test so far was a simulation of the planner only.

**Security and privacy:**
- `Content-Security-Policy` (`next.config.ts`) is **enforced** since 15 Oct 2026 (a crawl of public, customer and driver
  pages showed no violations). It keeps 'unsafe-inline' for scripts (Next.js needs it without per-request nonces). Any
  new outside service the browser talks to must be added there or it is blocked.
- Ghana Data Protection Act 2012: register with the Data Protection Commission. Fill the remaining privacy policy
  gaps (`lib/legal-content.ts`: registered company details, privacy contact email). Minimum age is 16 for customers
  (16-17 with a parent's permission) and 18 for drivers, confirmed by a sign-up checkbox (checked on the server too; the tick is not stored). Terms are filled (drivers are
  independent contractors, liability limited to the order price, disputes: support, then mediation, then courts;
  needs a lawyer's review before launch). Refund and Cookie policies are filled too.
  All four legal pages (13 Oct 2026) only lack the registered company details and the support contact.
- Data retention (policy section 6) runs nightly (`lib/retention*.ts`, on since 13 Oct 2026): photos and order pins
  12 months, alerts 90 days, unpaid drafts 30 days. Orders, payments, payouts and the ledger are kept 6 years and are
  **never deleted automatically**. After that they are anonymised (personal details removed, amounts and the ledger
  kept) one calendar year at a time on ops **Old records** (`/ops/records`, `lib/records-retention*.ts`): a super admin
  asks, a different super admin or finance user approves with their password. 2026 records are first due 1 Jan 2033.
- Confirm `NEXT_PUBLIC_SITE_URL` is set on Vercel and Supabase's redirect allow-list has only the real domain.

**Frontend** (full plan: Frontend Enhancement Plan; redesign build plan in 7 steps: 1 foundation (done 14 Oct), 2 logo and
launch screen (on hold, Collins wants to improve it), 3 customer app (done 14 Oct: home with the live 3D pin map, booking one question per screen, order timeline, icon rail,
dark mode switch), 4 driver app (done 14 Oct: Home tab with tonight's job, 3D area map and tips (our own data, plus tonight's weather from Open-Meteo and nearest fuel from
OpenStreetMap/Overpass: free, no keys, `lib/driver-tips.ts`, sent only the zone centre or a rounded point, cached, streamed in); full-screen
stop page with the pickup photo panel; Tonight, Earnings and Account restyled),
5 admin console (done 14 Oct: icon rail with hover names, live progress card, Needs you, exceptions as a list
beside a detail panel, plan board and maps in moss and sky; not yet seen on screen: ops needs a staff 2FA login), 6 website (done 15 Oct: the landing tour is the canvas design's pinned story, `components/landing/NightStory.tsx` +
`story.module.css`, CSS scroll-driven only: a 3D town, day to night to dawn, a route and truck, the booking card, then the
next section slides up over it like a curtain; a still list without scroll timelines or with reduced motion; new sign-in frame, legal pages,
footer, cookie banner; site-wide pointer effects in components/kit/PointerFx.tsx), 7 final checks (done 15 Oct: every main
page fits 320 px in Chromium and WebKit/iPhone Safari with no errors; Tailwind v4 needs Chrome 111+; Firefox could not
run here; real phones still worth a test)). Done earlier: dark/light theme, loading and error screens,
animated launch screen, ops console redesign, driver Tonight with trips and time estimates, price-a-pickup without an
account, alerts asked for at the right moment, settings that explain themselves. Still to check against the plan:
the remaining accessibility items (contrast, tap targets, labels) and shadcn/ui. Speed (15 Oct): photos use `next/image`
(public pictures resized to WebP; private ones lazy and `unoptimized`, never cached by the image service); anonymous
web-vitals go to `/api/vitals` and appear as `[vitals]` lines in the server log (nothing stored); driver pickups and
unloads without signal are kept on the phone and sent later (`lib/outbox.ts`, `components/driver/OutboxBar.tsx`; the
server keeps the photo time, `lib/taken-at.ts`, and treats a repeat as done). Tested at 320, 375, 390 and 1280 px wide.
UX fixes (16 Oct): a new customer's first step is the Home pin page (`components/customer/RequireHomePin.tsx`); the
home is an area or street plus a separate **landmark** (`CustomerProfile.homeLandmark`), shown together on orders as
"place · landmark" (`lib/home-address.ts`). Dark mode is per app (website, customer, driver, ops) on the device and saved
on the account (`User.themePrefs`, `lib/theme.ts`, `/api/account/theme`). Signing out opens the landing page; the
customer sign-out is on "Your account" and at the foot of the rail. Rails have a "Show names" button on touch screens.
A **driver's licence photo is required** to send an application (drivers approved earlier keep their approval). Public
pages draw their own footer (the global `Footer` is no longer used).
Ops console redesign (18 Oct): labelled sidebar on computers (icon rail on tablets, drawer on phones), headline tiles
(`Kpi`, `Card` in `components/ops/kit.tsx`) and server-drawn SVG charts (`components/ops/charts.tsx`, no chart library) on
Overview, Drivers, Ratings, Finance, Withdrawals and Exceptions; new read-only **Customers** page (`/ops/customers`,
`CUSTOMER_PAGE_ROLES` = Super Admin, Ops Manager, Finance, Support; phones masked by `maskPhone` in `lib/ops-stats.ts`). The
Overview's "Booked for tonight" value shows only to Super Admin, Ops Manager, Finance and Analyst.
If every `/api` route suddenly answers 404 in `npm run dev`, stop the server, delete `.next/dev` and start it again.

## Documents (on claude.ai)

- Trashit Project Handbook (overview, how to use, operator runbook with health-check SQL):
  https://claude.ai/code/artifact/8f55f9f7-6ac3-4d71-ae11-90e8c0c9fa11
- Trashit Frontend Enhancement Plan: https://claude.ai/code/artifact/f6eac5d5-47de-4573-bf73-ef2738f183dc
- Trashit Security and Compliance Test Plan: https://claude.ai/code/artifact/225ba51b-89b2-4f69-a531-6220d1a6049b
- Trashit Unified Design (canvas: options, the three apps, logo, website and sign-in designs):
  https://claude.ai/artifact/A1pYhHXBi1MVDmUKhuz4S7

## Working with Collins

- Explain steps plainly and say exactly what to run; he applies changes and runs commands himself when needed.
- Keep him involved in decisions on money, pricing and anything irreversible.
