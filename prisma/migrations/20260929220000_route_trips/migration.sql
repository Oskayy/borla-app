-- Each trip of a route ends at a disposal site.

-- CreateTable
CREATE TABLE "RouteTrip" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "tripNumber" INTEGER NOT NULL,
    "facilityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteTrip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteTrip_routeId_tripNumber_key" ON "RouteTrip"("routeId", "tripNumber");

-- AddForeignKey
ALTER TABLE "RouteTrip" ADD CONSTRAINT "RouteTrip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteTrip" ADD CONSTRAINT "RouteTrip_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep this table away from the public Supabase API, like the rest of the database.
ALTER TABLE "RouteTrip" ENABLE ROW LEVEL SECURITY;
