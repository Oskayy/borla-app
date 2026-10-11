-- Hazardous waste bookings: off until a disposal site accepts it. Ops turn it on under Shift hours.
ALTER TABLE "OperatingSettings" ADD COLUMN "acceptHazardous" BOOLEAN NOT NULL DEFAULT false;
