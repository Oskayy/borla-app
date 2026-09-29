-- Phase 3d.5: drivers go online / offline, limited to shift hours unless ops give an override.

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wentOnlineAt" TIMESTAMP(3),
ADD COLUMN     "onlineOverrideUntil" TIMESTAMP(3);
