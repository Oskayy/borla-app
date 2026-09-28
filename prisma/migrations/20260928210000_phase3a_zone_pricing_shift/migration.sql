-- Phase 3a: per-zone price multiplier, bin sizes priced inside each pricing rule,
-- late surcharge, platform fee, operating shift settings, and order shift assignment.

-- AlterTable: zone multiplier
ALTER TABLE "Zone" ADD COLUMN     "priceMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- AlterTable: pricing rule extras
ALTER TABLE "PricingRule" ADD COLUMN     "lateSurcharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable: order shift
ALTER TABLE "Order" ADD COLUMN     "isLateOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shiftDate" DATE;

-- CreateTable
CREATE TABLE "BinSize" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "litres" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BinSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRuleBinPrice" (
    "id" TEXT NOT NULL,
    "pricingRuleId" TEXT NOT NULL,
    "binSizeId" TEXT NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PricingRuleBinPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatingSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Accra',
    "shiftStartMinutes" INTEGER NOT NULL DEFAULT 1200,
    "shiftEndMinutes" INTEGER NOT NULL DEFAULT 360,
    "planningSnapshotMinutes" INTEGER NOT NULL DEFAULT 1080,
    "hardCutoffMinutes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BinSize_code_key" ON "BinSize"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PricingRuleBinPrice_pricingRuleId_binSizeId_key" ON "PricingRuleBinPrice"("pricingRuleId", "binSizeId");

-- CreateIndex
CREATE INDEX "Order_shiftDate_status_idx" ON "Order"("shiftDate", "status");

-- Existing orders never had a zone relation; clear any value that does not match a real zone.
UPDATE "Order" SET "zoneId" = NULL WHERE "zoneId" IS NOT NULL AND "zoneId" NOT IN (SELECT "id" FROM "Zone");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRuleBinPrice" ADD CONSTRAINT "PricingRuleBinPrice_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRuleBinPrice" ADD CONSTRAINT "PricingRuleBinPrice_binSizeId_fkey" FOREIGN KEY ("binSizeId") REFERENCES "BinSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Seed data (placeholders, all editable later)
-- ---------------------------------------------------------------------------

-- Bin sizes: placeholder capacities, change when real bin sizes are confirmed.
INSERT INTO "BinSize" ("id", "code", "label", "litres", "sortOrder") VALUES
  (gen_random_uuid()::text, 'small',  'Small bin',  30,  1),
  (gen_random_uuid()::text, 'medium', 'Medium bin', 60,  2),
  (gen_random_uuid()::text, 'large',  'Large bin',  120, 3);

-- Existing rules get a bin fee of 0 for every size, so their prices stay exactly as before
-- (base fee + per-bin charge x count). Set real bin fees by creating a new rule in /ops/pricing.
INSERT INTO "PricingRuleBinPrice" ("id", "pricingRuleId", "binSizeId", "fee")
SELECT gen_random_uuid()::text, r."id", b."id", 0
FROM "PricingRule" r CROSS JOIN "BinSize" b;

-- Operating window: 20:00-06:00 Africa/Accra, planning snapshot 18:00, hard cutoff 00:00.
INSERT INTO "OperatingSettings" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP);

-- Keep the new tables locked to the server, like the rest of the database:
-- row level security on with no policies means the public Supabase API cannot read or write them.
ALTER TABLE "BinSize" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PricingRuleBinPrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OperatingSettings" ENABLE ROW LEVEL SECURITY;
