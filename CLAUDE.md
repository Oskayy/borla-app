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
- Before calling work done: `npm run build` passes (it runs `prisma generate` + `next build`), and `npm run lint`.

## Business rules (placeholders are editable in the ops screens)

- Timezone **Africa/Accra**, same for all zones. Shift **8pm–6am**; planning snapshot **6pm**;
  late orders accepted until the **midnight** hard cutoff. Settings: `OperatingSettings` table, ops page Shift Hours.
- Price = base by bin size (30/60/120 L, placeholders) x **per-zone multiplier**. Customers must drop an exact
  pin (`locationSource` `home_pin` or `pin`); the price is worked out on the server, never trusted from the browser.
- Platform fee is taken off the top; the **driver pool** is paid **40% at pickup, 60% at disposal**
  (disposal released by the site geofence, or by ops review on "Unloads to Check"). `PayoutRule` table.
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
- Money: `lib/wallet*.ts` (balance = ledger earnings with `driverId` minus withdrawals REQUESTED/PROCESSING/PAID),
  `lib/refunds*.ts`, `lib/paystack.ts`. Money writes use Serializable transactions and idempotency keys.
- Rate limiting: `lib/rate-limit.ts` (login, signup, reset, withdrawals and others).

### Environment variable names (values are in `.env`, never read it)

`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `ARKESEL_API_KEY`, `SMS_SENDER_ID`.

## Open work (as of Oct 2026)

**Setup (checked 4 Oct 2026):** database migrations up to date (latest `20261001090000_launch_gaps`), build and lint
pass, `driver-documents` bucket exists and is private, work committed and pushed. Still open:
- Paystack: turn off "Confirm transfers before sending" (OTP) in Preferences → Transfers, in Test and later Live mode,
  or withdrawals get stuck waiting for an OTP.
- **Parked: Arkesel SMS.** `ARKESEL_API_KEY` and `SMS_SENDER_ID` are not set yet, on purpose. The app runs without them:
  SMS is skipped (one `[sms] SMS is off` warning in the server log) and in-app + push alerts still go out.
  Needed before launch, and before security fix F1 (which texts the old MoMo number).

Email confirmation is deliberately **off** while testing with made-up emails.

**Security fixes, in priority order** (full plan: Security and Compliance Test Plan):
1. F1 (High): changing the driver MoMo payout number takes effect at once. Add an SMS to the old number,
   a 24–48 h hold on withdrawals after a change, and a password re-check.
2. F2: add `Strict-Transport-Security` and a `Content-Security-Policy` (start report-only; allow Mapbox and Paystack).
3. F3: `lib/rate-limit.ts` trusts the first `X-Forwarded-For` value; use the host's trusted client-IP header.
4. F4: GPS and photo plausibility checks (accuracy, speed, time on site, duplicate photos); flag, don't block.
5. F5: second approver for manual "mark paid" withdrawals and large refunds.
6. F6: authorisation tests for every API route (customer A cannot see customer B's data; roles enforced).

**Frontend phases** (full plan: Frontend Enhancement Plan):
1. Accessibility: replace `#999` text (fails contrast) with `#6B6B6B`; input borders `#8A8375`; `:focus-visible`;
   44–48 px tap targets; real labels; `aria-live` for errors and success; icons + words beside status colours.
2. Design system: Tailwind v4 tokens, dark theme, shadcn/ui components, `loading.tsx`/`error.tsx`.
3. Ease of use: step-by-step booking, order timeline, driver "next stop" home and night mode, ops dashboard.
4. Speed: `next/image`, lazy-loaded maps, adaptive loading, offline-tolerant driver actions, web-vitals.

## Documents (on claude.ai)

- Trashit Project Handbook (overview, how to use, operator runbook with health-check SQL):
  https://claude.ai/code/artifact/8f55f9f7-6ac3-4d71-ae11-90e8c0c9fa11
- Trashit Frontend Enhancement Plan: https://claude.ai/code/artifact/f6eac5d5-47de-4573-bf73-ef2738f183dc
- Trashit Security and Compliance Test Plan: https://claude.ai/code/artifact/225ba51b-89b2-4f69-a531-6220d1a6049b

## Working with Collins

- Explain steps plainly and say exactly what to run; he applies changes and runs commands himself when needed.
- Keep him involved in decisions on money, pricing and anything irreversible.
