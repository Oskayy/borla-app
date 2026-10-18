-- Zones become outlines drawn on the map. Each existing circle becomes a 32-sided outline drawn just outside it
-- (radius / cos(pi/32), plus 0.1%, on the same 6,371 km Earth as the old circle check), so every address that was inside the circle is still inside its zone. Same formula as
-- circleToBoundary in lib/zone-shape.ts. Zones without a centre get no outline and keep working as before.
CREATE TYPE "ZoneTier" AS ENUM ('PREMIUM', 'STANDARD', 'BASIC');
ALTER TABLE "Zone" ADD COLUMN "boundary" JSONB;
ALTER TABLE "Zone" ADD COLUMN "tier" "ZoneTier" NOT NULL DEFAULT 'STANDARD';

UPDATE "Zone" z
SET "boundary" = jsonb_build_object(
  'type', 'Polygon',
  'coordinates', jsonb_build_array((
    SELECT jsonb_agg(
      jsonb_build_array(
        round((z."centerLng" + (z."radiusKm" / cos(pi() / 32) * 1.001) / (6371 * pi() / 180 * cos(radians(z."centerLat"))) * cos(2 * pi() * (i % 32) / 32))::numeric, 6),
        round((z."centerLat" + (z."radiusKm" / cos(pi() / 32) * 1.001) / (6371 * pi() / 180) * sin(2 * pi() * (i % 32) / 32))::numeric, 6)
      ) ORDER BY i)
    FROM generate_series(0, 32) AS i
  ))
)
WHERE z."centerLat" IS NOT NULL AND z."centerLng" IS NOT NULL;
