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

## Business rules (placeholders are editable in the ops screens)

- Timezone **Africa/Accra**, same for all zones. Shift **8pm–6am**; planning snapshot **6pm**;
  late orders accepted until the **midnight** hard cutoff. Settings: `OperatingSettings` table, ops page Shift Hours.
- Price = base by bin size (30/60/120 L, placeholders) x **per-zone multiplier**. Customers must drop an exact
  pin (`locationSource` `home_pin` or `pin`); the price is worked out on the server, never trusted from the browser.
- Platform fee is taken off the top; the **driver pool** is paid **40% at pickup, 60% at disposal**
  (disposal released by the site geofence, or by ops review on "Unloads to Check"). `PayoutRule` table.
  The split is **frozen on the order at payment** in whole pesewas and basis points, remainder last (`lib/money-split.ts`).
- Driver earnings **clear 24 h** after the later of unload and shift end, unless a complaint or refund is open; pickup
  shares wait for the unload; new drivers keep a small reserve (`lib/earnings.ts`). Refunds with **driver fault** claw back
  their shares; customer-fault failed pickups keep a **25% attempt fee**, partly paid to the driver. Trashit absorbs
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
- Brand: `lib/brand.ts`, `components/Logo.tsx`, `public/brand/*`. Colours: primary `#0F3D3E`, accent `#E8A33D`, background `#F7F5F1`.
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
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `ARKESEL_API_KEY`, `SMS_SENDER_ID`.

## Open work (as of 13 Oct 2026)

**State (checked 13 Oct 2026):** all migrations applied (latest `20261012150000_step7_pay_and_tax`); build, lint and tests
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

**Parked: Arkesel SMS.** `ARKESEL_API_KEY` and `SMS_SENDER_ID` are not set, on purpose. The app runs without them (SMS
skipped, one `[sms] SMS is off` warning; in-app and push alerts still go out). Needed before launch and before security
fix F1 (which texts the old MoMo number). Email confirmation is deliberately **off** while testing with made-up emails.

**Staging Supabase project (not created yet):** needed for `tests/security/cross-account.test.ts` (two test customers
and a driver) and for an end-to-end stress test (real accounts, bookings, payments and the dispatch sweep). The
dispatch stress test so far was a simulation of the planner only.

**Security and privacy:**
- Switch `Content-Security-Policy-Report-Only` (`next.config.ts`) to enforcing once the console shows no reports on the
  map and booking pages; the inline theme script in `app/layout.tsx` will need a hash or nonce.
- Ghana Data Protection Act 2012: register with the Data Protection Commission. Fill the remaining privacy policy
  placeholders (`lib/legal-content.ts`: company name and address, contact email, section 4 legal basis).
- Data retention (policy section 6) runs nightly (`lib/retention*.ts`, on since 13 Oct 2026): photos and order pins
  12 months, alerts 90 days, unpaid drafts 30 days. Orders, payments, payouts and the ledger are kept 6 years and are
  **never deleted automatically**: deleting them needs an admin to approve it (not built yet; first due Sept 2032).
- Confirm `NEXT_PUBLIC_SITE_URL` is set on Vercel and Supabase's redirect allow-list has only the real domain.

**Frontend** (full plan: Frontend Enhancement Plan). Done so far: dark/light theme, loading and error screens,
animated launch screen, ops console redesign, driver Tonight with trips and time estimates, price-a-pickup without an
account, alerts asked for at the right moment, settings that explain themselves. Still to check against the plan:
the remaining accessibility items (contrast, tap targets, labels), shadcn/ui, and speed (`next/image`, lazy maps,
offline-tolerant driver actions, web-vitals). Tested at 375 px and 1280 px wide; not yet on very small phones (320 px),
iPhone Safari or older Android browsers.

## Documents (on claude.ai)

- Trashit Project Handbook (overview, how to use, operator runbook with health-check SQL):
  https://claude.ai/code/artifact/8f55f9f7-6ac3-4d71-ae11-90e8c0c9fa11
- Trashit Frontend Enhancement Plan: https://claude.ai/code/artifact/f6eac5d5-47de-4573-bf73-ef2738f183dc
- Trashit Security and Compliance Test Plan: https://claude.ai/code/artifact/225ba51b-89b2-4f69-a531-6220d1a6049b

## Working with Collins

- Explain steps plainly and say exactly what to run; he applies changes and runs commands himself when needed.
- Keep him involved in decisions on money, pricing and anything irreversible.
