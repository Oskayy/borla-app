-- Nightly jobs: plan-ready notice, automatic dispatch from shift start, and rollover of uncollected orders.

-- AlterTable
ALTER TABLE "OperatingSettings" ADD COLUMN "autoDispatch" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "rolloverCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "JobRun" (
    "key" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("key")
);

-- Keep this table away from the public Supabase API, like the rest of the database.
ALTER TABLE "JobRun" ENABLE ROW LEVEL SECURITY;
