-- Assignment and payment review (22 Nov 2026): Paystack checkout reference, home base moves wait for ops, unload
-- codes and weighbridge tickets, refund request keys, dispute kinds, and the six order statuses that were never used.

-- Paystack checkout on the order
ALTER TABLE "Order" ADD COLUMN "paystackReference" TEXT,
ADD COLUMN "checkoutUrl" TEXT,
ADD COLUMN "checkoutStartedAt" TIMESTAMP(3),
ADD COLUMN "paymentCheckedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Order_paystackReference_key" ON "Order"("paystackReference");

-- Home base and zone moves by approved drivers wait for ops
ALTER TABLE "DriverProfile" ADD COLUMN "pendingHomeLat" DOUBLE PRECISION,
ADD COLUMN "pendingHomeLng" DOUBLE PRECISION,
ADD COLUMN "pendingHomeAddress" TEXT,
ADD COLUMN "pendingZoneId" TEXT,
ADD COLUMN "pendingHomeAt" TIMESTAMP(3),
ADD COLUMN "homeChangeNote" TEXT;

-- Unload proof at disposal sites
ALTER TABLE "Facility" ADD COLUMN "unloadCode" TEXT,
ADD COLUMN "ticketRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderEvidence" ADD COLUMN "ticketNumber" TEXT;

-- One refund per staff request
ALTER TABLE "Refund" ADD COLUMN "requestKey" TEXT;
CREATE UNIQUE INDEX "Refund_requestKey_key" ON "Refund"("requestKey");

-- What raised a dispute (existing rows were all raised by drivers)
ALTER TABLE "Dispute" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'DRIVER';

-- Order statuses: drop the six the app never set. Stops here if any order uses one.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Order"
    WHERE "status"::text IN ('PENDING_PAYMENT', 'READY_FOR_BATCH', 'EN_ROUTE', 'ARRIVED', 'PICKUP_PENDING_REVIEW', 'DISPOSAL_VERIFIED')
  ) THEN
    RAISE EXCEPTION 'An order uses a status that is being removed; fix it before running this migration';
  END IF;
END $$;

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PAID', 'ASSIGNED', 'PICKED_UP', 'DISPOSAL_PENDING', 'COMPLETED', 'FAILED_PICKUP', 'DISPUTED', 'CANCELLED');
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus" USING ("status"::text::"OrderStatus");
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "OrderStatus_old";
