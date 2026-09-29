-- Phase 3d.4: disposal sites (landfills / transfer stations) on the map.

-- AlterTable: a site no longer has to belong to a single zone
ALTER TABLE "Facility" ALTER COLUMN "zoneId" DROP NOT NULL;

-- AlterTable: location, geofence, hours, waste types, status, unload time
ALTER TABLE "Facility" ADD COLUMN     "address" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "geofenceRadiusM" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN     "open24Hours" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "opensAtMinutes" INTEGER,
ADD COLUMN     "closesAtMinutes" INTEGER,
ADD COLUMN     "acceptedWaste" TEXT[] DEFAULT ARRAY['general', 'recyclable']::TEXT[],
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "avgUnloadMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Placeholder sites: rough positions only. Move the pins on the Disposal Sites page once real sites are confirmed.
INSERT INTO "Facility" ("id", "name", "address", "lat", "lng", "notes") VALUES
  (gen_random_uuid()::text, 'Placeholder site — Tema/Kpone side', 'Placeholder: move this pin to the real site', 5.6980, 0.0450, 'Placeholder. Confirm the real location, night hours and accepted waste.'),
  (gen_random_uuid()::text, 'Placeholder site — Accra west side', 'Placeholder: move this pin to the real site', 5.5700, -0.3100, 'Placeholder. Confirm the real location, night hours and accepted waste.');