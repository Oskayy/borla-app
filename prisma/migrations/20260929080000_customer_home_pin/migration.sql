-- Phase 3c: the customer's saved home pin, reused on every booking.

-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "homeLat" DOUBLE PRECISION,
ADD COLUMN     "homeLng" DOUBLE PRECISION,
ADD COLUMN     "homeUpdatedAt" TIMESTAMP(3);