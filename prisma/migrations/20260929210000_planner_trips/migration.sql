-- Automatic planner: trips per night, and which trip each stop belongs to.

-- AlterTable
ALTER TABLE "OperatingSettings" ADD COLUMN     "maxTripsPerNight" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "RouteStop" ADD COLUMN     "tripNumber" INTEGER NOT NULL DEFAULT 1;
