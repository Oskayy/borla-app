-- Weekly availability: the nights a driver works (0 = Sunday, by the date the shift starts),
-- plus single nights off (YYYY-MM-DD shift dates). Dispatch leaves drivers out on nights they are off.
ALTER TABLE "DriverProfile" ADD COLUMN "workNights" INTEGER[] NOT NULL DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
ADD COLUMN "nightsOff" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
