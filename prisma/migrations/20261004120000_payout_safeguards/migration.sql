-- F1: a replaced MoMo wallet starts a 24-hour hold on withdrawals.
ALTER TABLE "DriverProfile" ADD COLUMN "momoChangedAt" TIMESTAMP(3);

-- F5: manual withdrawal payments and large staff refunds need a second approver.
ALTER TABLE "Withdrawal" ADD COLUMN "markedPaidBy" TEXT,
ADD COLUMN "markedPaidAt" TIMESTAMP(3);

ALTER TABLE "Refund" ADD COLUMN "cancelOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "approvedBy" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3);

-- F4: photo fingerprints, to flag the same photo used for two orders.
ALTER TABLE "OrderEvidence" ADD COLUMN "photoHash" TEXT;
CREATE INDEX "OrderEvidence_photoHash_idx" ON "OrderEvidence"("photoHash");
