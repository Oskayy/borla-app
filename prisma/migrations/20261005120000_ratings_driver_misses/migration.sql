-- Customer ratings of collected pickups (1-5 stars, optional comment), one per order.
CREATE TABLE "OrderRating" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderRating_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrderRating_stars_check" CHECK ("stars" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "OrderRating_orderId_key" ON "OrderRating"("orderId");
CREATE INDEX "OrderRating_driverId_createdAt_idx" ON "OrderRating"("driverId", "createdAt");
CREATE INDEX "OrderRating_stars_reviewedAt_idx" ON "OrderRating"("stars", "reviewedAt");
ALTER TABLE "OrderRating" ADD CONSTRAINT "OrderRating_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderRating" ADD CONSTRAINT "OrderRating_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderRating" ENABLE ROW LEVEL SECURITY;

-- Stops a driver didn't do (declined, accept time ran out, or accepted but not collected by shift end).
CREATE TABLE "DriverMiss" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT,
    "shiftDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverMiss_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DriverMiss_driverId_createdAt_idx" ON "DriverMiss"("driverId", "createdAt");
ALTER TABLE "DriverMiss" ADD CONSTRAINT "DriverMiss_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverMiss" ADD CONSTRAINT "DriverMiss_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverMiss" ENABLE ROW LEVEL SECURITY;

-- Start the history from the declines and expiries still on record.
INSERT INTO "DriverMiss" ("id", "driverId", "orderId", "kind", "reason", "shiftDate", "createdAt")
SELECT gen_random_uuid()::text, d."driverId", d."orderId",
       CASE WHEN d."reason" LIKE 'No answer within%' THEN 'EXPIRED' ELSE 'DECLINED' END,
       d."reason", o."shiftDate", d."createdAt"
FROM "OrderDecline" d JOIN "Order" o ON o."id" = d."orderId";
