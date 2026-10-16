-- A customer's home landmark, kept apart from the place found from their pin, and each person's dark-mode choice per
-- app (website, customer, driver, ops), so it follows them to any device. Both optional; nothing existing changes.
ALTER TABLE "CustomerProfile" ADD COLUMN "homeLandmark" TEXT;
ALTER TABLE "User" ADD COLUMN "themePrefs" JSONB;
