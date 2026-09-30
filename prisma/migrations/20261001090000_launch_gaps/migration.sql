-- Launch gaps: driver payouts, refunds and cancellations, driver approval, staff accounts, customer updates.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "approvalNote" TEXT,
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedBy" TEXT,
ADD COLUMN "momoNumber" TEXT,
ADD COLUMN "momoProvider" TEXT,
ADD COLUMN "momoName" TEXT,
ADD COLUMN "paystackRecipientCode" TEXT,
ADD COLUMN "recipientFor" TEXT;

-- Drivers who already exist keep working: they count as approved.
UPDATE "DriverProfile" SET "approvalStatus" = 'APPROVED', "reviewedAt" = CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "assignedNoticeAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelReason" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN "driverId" TEXT;

-- Earnings already recorded belong to the driver on the order.
UPDATE "LedgerEntry" le SET "driverId" = o."driverId"
FROM "Order" o
WHERE le."orderId" = o."id" AND le."type" IN ('driver_payout_pickup', 'driver_payout_disposal');

-- CreateIndex
CREATE INDEX "LedgerEntry_driverId_idx" ON "LedgerEntry"("driverId");

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "momoNumber" TEXT NOT NULL,
    "momoProvider" TEXT NOT NULL,
    "momoName" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "transferCode" TEXT,
    "method" TEXT,
    "note" TEXT,
    "reviewedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paystackRefundId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverDocument" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_reference_key" ON "Withdrawal"("reference");
CREATE INDEX "Withdrawal_driverId_status_idx" ON "Withdrawal"("driverId", "status");
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");
CREATE UNIQUE INDEX "Refund_paystackRefundId_key" ON "Refund"("paystackRefundId");
CREATE INDEX "Refund_orderId_idx" ON "Refund"("orderId");
CREATE INDEX "Refund_status_idx" ON "Refund"("status");
CREATE INDEX "DriverDocument_driverId_type_idx" ON "DriverDocument"("driverId", "type");

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverDocument" ADD CONSTRAINT "DriverDocument_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep these tables away from the public Supabase API, like the rest of the database.
ALTER TABLE "Withdrawal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Refund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DriverDocument" ENABLE ROW LEVEL SECURITY;
