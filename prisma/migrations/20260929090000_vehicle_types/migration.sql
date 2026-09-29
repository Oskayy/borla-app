-- Phase 3d.1: vehicle types with capacity and radius limits.

-- CreateTable
CREATE TABLE "VehicleType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacityLitres" INTEGER NOT NULL,
    "defaultRadiusKm" DOUBLE PRECISION NOT NULL,
    "maxRadiusKm" DOUBLE PRECISION NOT NULL,
    "imagePath" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleType_code_key" ON "VehicleType"("code");

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "radiusKm" DOUBLE PRECISION,
ADD COLUMN     "vehicleTypeId" TEXT;

-- AddForeignKey
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "VehicleType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep this table away from the public Supabase API, like the rest of the database.
ALTER TABLE "VehicleType" ENABLE ROW LEVEL SECURITY;

-- Placeholder vehicles (rough estimates, all editable on the Vehicles page).
INSERT INTO "VehicleType" ("id", "code", "name", "capacityLitres", "defaultRadiusKm", "maxRadiusKm", "imagePath", "sortOrder") VALUES
  (gen_random_uuid()::text, 'aboboyaa',     'Aboboyaa tricycle', 1200, 3, 6,  '/vehicles/aboboyaa.svg',     1),
  (gen_random_uuid()::text, 'borla-car',    'Borla car',         3000, 5, 10, '/vehicles/borla-car.svg',    2),
  (gen_random_uuid()::text, 'tipper-truck', 'Tipper truck',      8000, 8, 15, '/vehicles/tipper-truck.svg', 3);

-- Link existing drivers to their vehicle type and give them that type's default radius.
UPDATE "DriverProfile" d
SET "vehicleTypeId" = v."id", "radiusKm" = v."defaultRadiusKm"
FROM "VehicleType" v
WHERE (d."vehicleType" = 'Aboboyaa tricycle' AND v."code" = 'aboboyaa')
   OR (d."vehicleType" = 'Borla car' AND v."code" = 'borla-car');
   