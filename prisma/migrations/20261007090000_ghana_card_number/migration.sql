-- Drivers type their Ghana Card number instead of uploading a photo of the card.
ALTER TABLE "DriverProfile" ADD COLUMN "ghanaCardNumber" TEXT;
CREATE UNIQUE INDEX "DriverProfile_ghanaCardNumber_key" ON "DriverProfile"("ghanaCardNumber");
