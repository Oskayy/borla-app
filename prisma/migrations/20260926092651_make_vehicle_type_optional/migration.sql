-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "homeAddress" TEXT,
ADD COLUMN     "homeLat" DOUBLE PRECISION,
ADD COLUMN     "homeLng" DOUBLE PRECISION,
ALTER COLUMN "vehicleType" DROP NOT NULL;
