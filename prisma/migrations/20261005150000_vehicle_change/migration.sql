-- An approved driver who changes vehicle type keeps working on the current vehicle until ops approve the new one.
ALTER TABLE "DriverProfile" ADD COLUMN "pendingVehicleTypeId" TEXT,
ADD COLUMN "pendingRadiusKm" DOUBLE PRECISION,
ADD COLUMN "pendingVehicleAt" TIMESTAMP(3),
ADD COLUMN "vehicleChangeNote" TEXT;
