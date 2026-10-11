-- Payment flow rewrite, steps 2-3.
-- 1. Each order keeps its price split, frozen at payment, in whole pesewas and basis points.
ALTER TABLE "Order"
  ADD COLUMN "pricePesewas" INTEGER,
  ADD COLUMN "platformFeePesewas" INTEGER,
  ADD COLUMN "pickupSharePesewas" INTEGER,
  ADD COLUMN "unloadSharePesewas" INTEGER,
  ADD COLUMN "feeBps" INTEGER,
  ADD COLUMN "pickupBps" INTEGER,
  ADD COLUMN "splitFrozenAt" TIMESTAMP(3);

-- The parts always add up to the price, and nothing is negative.
ALTER TABLE "Order" ADD CONSTRAINT "Order_split_adds_up" CHECK (
  "pricePesewas" IS NULL OR (
    "platformFeePesewas" >= 0 AND "pickupSharePesewas" >= 0 AND "unloadSharePesewas" >= 0
    AND "platformFeePesewas" + "pickupSharePesewas" + "unloadSharePesewas" = "pricePesewas"
    AND "feeBps" BETWEEN 0 AND 10000 AND "pickupBps" BETWEEN 0 AND 10000
  )
);

-- 2. Ledger amounts in whole pesewas, and when driver earnings become withdrawable.
ALTER TABLE "LedgerEntry"
  ADD COLUMN "amountPesewas" INTEGER,
  ADD COLUMN "clearsAt" TIMESTAMP(3);

UPDATE "LedgerEntry" SET "amountPesewas" = ROUND("amount" * 100)::INTEGER;

-- Earnings recorded before clearing existed: orders that were completed are available as before.
UPDATE "LedgerEntry" l SET "clearsAt" = l."createdAt"
FROM "Order" o
WHERE l."orderId" = o."id"
  AND l."type" IN ('driver_payout_pickup', 'driver_payout_disposal')
  AND o."status" = 'COMPLETED';

CREATE INDEX "LedgerEntry_driverId_type_idx" ON "LedgerEntry"("driverId", "type");

-- 3. Refunds can record that the driver was at fault (their shares of the order are taken back).
ALTER TABLE "Refund" ADD COLUMN "driverFault" BOOLEAN NOT NULL DEFAULT false;
