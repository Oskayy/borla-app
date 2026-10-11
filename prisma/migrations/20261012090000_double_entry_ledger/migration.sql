-- Payment flow rewrite, steps 4-6: double-entry ledger, daily payouts, reconciliation.

-- Withdrawals: where they came from, and the transfer fee the driver pays (extra cash-outs).
ALTER TABLE "Withdrawal"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'request',
  ADD COLUMN "feePesewas" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Journal" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "orderId" TEXT,
  "driverId" TEXT,
  "memo" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Journal_key_key" ON "Journal"("key");
CREATE INDEX "Journal_orderId_idx" ON "Journal"("orderId");
CREATE INDEX "Journal_createdAt_idx" ON "Journal"("createdAt");

CREATE TABLE "Posting" (
  "id" TEXT NOT NULL,
  "journalId" TEXT NOT NULL,
  "account" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "orderId" TEXT,
  "driverId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Posting_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Posting_journalId_idx" ON "Posting"("journalId");
CREATE INDEX "Posting_account_orderId_idx" ON "Posting"("account", "orderId");
CREATE INDEX "Posting_account_driverId_idx" ON "Posting"("account", "driverId");
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PaystackSettlement" (
  "id" TEXT NOT NULL,
  "paystackId" TEXT NOT NULL,
  "settledAt" TIMESTAMP(3) NOT NULL,
  "amountPesewas" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "receivedPesewas" INTEGER,
  "confirmedBy" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaystackSettlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaystackSettlement_paystackId_key" ON "PaystackSettlement"("paystackId");

CREATE TABLE "TreasuryCheck" (
  "id" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "drivers" INTEGER NOT NULL,
  "duePesewas" INTEGER NOT NULL,
  "feesPesewas" INTEGER NOT NULL,
  "bufferPesewas" INTEGER NOT NULL,
  "balancePesewas" INTEGER,
  "topUpPesewas" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreasuryCheck_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TreasuryCheck_day_key" ON "TreasuryCheck"("day");

CREATE TABLE "ReconciliationRun" (
  "id" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "ok" BOOLEAN NOT NULL,
  "results" JSONB NOT NULL,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReconciliationRun_day_key" ON "ReconciliationRun"("day");

-- Only the server (which bypasses RLS) may touch money tables.
ALTER TABLE "Journal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Posting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaystackSettlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreasuryCheck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReconciliationRun" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------------------------------
-- One-off conversion of the old one-row-per-event ledger into balanced journals.
-- It stops (and nothing is changed) if it finds money records it doesn't know how to convert.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "LedgerEntry" WHERE "type" NOT IN ('customer_payment', 'platform_fee', 'driver_payout_pickup', 'driver_payout_disposal')) THEN
    RAISE EXCEPTION 'Conversion stopped: refunds, clawbacks or attempt fees exist in the old ledger. Ask for the conversion to be extended.';
  END IF;
  IF EXISTS (SELECT 1 FROM "Withdrawal" WHERE "status" IN ('PAID', 'PROCESSING', 'CONFIRMING')) THEN
    RAISE EXCEPTION 'Conversion stopped: driver withdrawals exist. Ask for the conversion to be extended.';
  END IF;
END $$;

CREATE TEMP TABLE conv_entry AS
  SELECT gen_random_uuid()::text AS jid, l.*
  FROM "LedgerEntry" l
  WHERE l."type" IN ('customer_payment', 'driver_payout_pickup', 'driver_payout_disposal');

INSERT INTO "Journal" ("id", "key", "event", "orderId", "driverId", "memo", "createdAt")
SELECT jid, "idempotencyKey", CASE WHEN "type" = 'customer_payment' THEN 'payment' ELSE 'earned' END,
       "orderId", "driverId", 'Converted from the old ledger', "createdAt"
FROM conv_entry;

-- Customer payments: Paystack holds the money, held for the order.
INSERT INTO "Posting" ("id", "journalId", "account", "amount", "orderId", "driverId", "createdAt")
SELECT gen_random_uuid()::text, jid, 'paystack_clearing', "amountPesewas", NULL, NULL, "createdAt" FROM conv_entry WHERE "type" = 'customer_payment'
UNION ALL
SELECT gen_random_uuid()::text, jid, 'customer_funds_held', -"amountPesewas", "orderId", NULL, "createdAt" FROM conv_entry WHERE "type" = 'customer_payment'
-- Driver earnings: from the order's held money to what Trashit owes the driver.
UNION ALL
SELECT gen_random_uuid()::text, jid, 'customer_funds_held', "amountPesewas", "orderId", NULL, "createdAt" FROM conv_entry WHERE "type" <> 'customer_payment'
UNION ALL
SELECT gen_random_uuid()::text, jid, 'driver_payable', -"amountPesewas", "orderId", "driverId", "createdAt" FROM conv_entry WHERE "type" <> 'customer_payment';

-- Paystack's fee on each past payment wasn't recorded: estimated at 1.95% (marked as estimated).
CREATE TEMP TABLE conv_fee AS
  SELECT gen_random_uuid()::text AS jid, "orderId", substr("idempotencyKey", 9) AS ref, "createdAt",
         CEIL("amountPesewas" * 195 / 10000.0)::int AS fee
  FROM conv_entry WHERE "type" = 'customer_payment';
INSERT INTO "Journal" ("id", "key", "event", "orderId", "memo", "createdAt")
SELECT jid, 'payment-fee-' || ref, 'payment_fee', "orderId", 'Converted: Paystack fee estimated at 1.95%', "createdAt" FROM conv_fee;
INSERT INTO "Posting" ("id", "journalId", "account", "amount", "orderId", "createdAt")
SELECT gen_random_uuid()::text, jid, 'payment_fees', fee, "orderId", "createdAt" FROM conv_fee
UNION ALL
SELECT gen_random_uuid()::text, jid, 'paystack_clearing', -fee, NULL, "createdAt" FROM conv_fee;

-- Finished jobs: what's still held for the order is Trashit's platform fee, now counted as income.
CREATE TEMP TABLE conv_income AS
  SELECT gen_random_uuid()::text AS jid, o."id" AS "orderId", -SUM(p."amount")::int AS fee
  FROM "Order" o JOIN "Posting" p ON p."orderId" = o."id" AND p."account" = 'customer_funds_held'
  WHERE o."status" = 'COMPLETED'
  GROUP BY o."id"
  HAVING -SUM(p."amount") > 0;
INSERT INTO "Journal" ("id", "key", "event", "orderId", "memo")
SELECT jid, 'fee-income-' || "orderId", 'fee_income', "orderId", 'Converted: platform fee of a finished job' FROM conv_income;
INSERT INTO "Posting" ("id", "journalId", "account", "amount", "orderId")
SELECT gen_random_uuid()::text, jid, 'customer_funds_held', fee, "orderId" FROM conv_income
UNION ALL
SELECT gen_random_uuid()::text, jid, 'platform_fee_income', -fee, "orderId" FROM conv_income;

-- Finished jobs where drivers were paid more than the customer paid (the old split read whichever payout rule
-- was active at pickup and at unload): the overpayment is recorded as a difference to look at, not hidden.
CREATE TEMP TABLE conv_over AS
  SELECT gen_random_uuid()::text AS jid, o."id" AS "orderId", SUM(p."amount")::int AS over
  FROM "Order" o JOIN "Posting" p ON p."orderId" = o."id" AND p."account" = 'customer_funds_held'
  WHERE o."status" = 'COMPLETED'
  GROUP BY o."id"
  HAVING SUM(p."amount") > 0;
INSERT INTO "Journal" ("id", "key", "event", "orderId", "memo")
SELECT jid, 'overpaid-' || "orderId", 'correction', "orderId", 'Converted: drivers were paid more than the customer paid (old split rules)' FROM conv_over;
INSERT INTO "Posting" ("id", "journalId", "account", "amount", "orderId")
SELECT gen_random_uuid()::text, jid, 'reconciliation_differences', over, "orderId" FROM conv_over
UNION ALL
SELECT gen_random_uuid()::text, jid, 'customer_funds_held', -over, "orderId" FROM conv_over;

-- Checks: every journal balances, finished jobs hold nothing, and nothing was lost in the conversion.
DO $$
DECLARE bad INT; held INT; paid BIGINT; earned BIGINT; owed BIGINT; clearing BIGINT;
BEGIN
  SELECT count(*) INTO bad FROM (SELECT "journalId" FROM "Posting" GROUP BY "journalId" HAVING SUM("amount") <> 0 OR count(*) < 2) x;
  IF bad > 0 THEN RAISE EXCEPTION 'Conversion check failed: % journals do not balance', bad; END IF;
  SELECT count(*) INTO held FROM (
    SELECT p."orderId" FROM "Posting" p JOIN "Order" o ON o."id" = p."orderId"
    WHERE p."account" = 'customer_funds_held' AND o."status" = 'COMPLETED' GROUP BY p."orderId" HAVING SUM(p."amount") <> 0) x;
  IF held > 0 THEN RAISE EXCEPTION 'Conversion check failed: % finished orders still hold money', held; END IF;
  SELECT COALESCE(SUM("amountPesewas"), 0) INTO paid FROM "LedgerEntry" WHERE "type" = 'customer_payment';
  SELECT COALESCE(SUM("amount"), 0) INTO clearing FROM "Posting" WHERE "account" = 'paystack_clearing' AND "amount" > 0;
  IF paid <> clearing THEN RAISE EXCEPTION 'Conversion check failed: payments % vs ledger %', paid, clearing; END IF;
  SELECT COALESCE(SUM("amountPesewas"), 0) INTO earned FROM "LedgerEntry" WHERE "type" IN ('driver_payout_pickup', 'driver_payout_disposal');
  SELECT -COALESCE(SUM("amount"), 0) INTO owed FROM "Posting" WHERE "account" = 'driver_payable';
  IF earned <> owed THEN RAISE EXCEPTION 'Conversion check failed: driver earnings % vs owed %', earned, owed; END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------
-- From now on: every journal must balance (checked when the transaction commits), and ledger rows can't
-- be changed or deleted.
CREATE OR REPLACE FUNCTION trashit_journal_balanced() RETURNS trigger AS $fn$
DECLARE s BIGINT; n INT;
BEGIN
  SELECT COALESCE(SUM("amount"), 0), count(*) INTO s, n FROM "Posting" WHERE "journalId" = NEW."journalId";
  IF s <> 0 OR n < 2 THEN
    RAISE EXCEPTION 'Journal % does not balance (sum %, % postings)', NEW."journalId", s, n;
  END IF;
  RETURN NULL;
END
$fn$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Posting_balanced"
  AFTER INSERT ON "Posting" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trashit_journal_balanced();

CREATE OR REPLACE FUNCTION trashit_ledger_append_only() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'Ledger rows cannot be changed or deleted; post a correcting journal instead';
END
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER "Posting_append_only" BEFORE UPDATE OR DELETE ON "Posting" FOR EACH ROW EXECUTE FUNCTION trashit_ledger_append_only();
CREATE TRIGGER "Journal_append_only" BEFORE UPDATE OR DELETE ON "Journal" FOR EACH ROW EXECUTE FUNCTION trashit_ledger_append_only();
