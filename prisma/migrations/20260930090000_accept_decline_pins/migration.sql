-- Drivers accept or decline assigned stops; customers confirm their home pin.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "driverAcceptedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN "homePinConfirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrderDecline" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDecline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderDecline_orderId_driverId_key" ON "OrderDecline"("orderId", "driverId");

-- CreateIndex
CREATE INDEX "OrderDecline_driverId_idx" ON "OrderDecline"("driverId");

-- AddForeignKey
ALTER TABLE "OrderDecline" ADD CONSTRAINT "OrderDecline_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDecline" ADD CONSTRAINT "OrderDecline_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep this table away from the public Supabase API, like the rest of the database.
ALTER TABLE "OrderDecline" ENABLE ROW LEVEL SECURITY;
