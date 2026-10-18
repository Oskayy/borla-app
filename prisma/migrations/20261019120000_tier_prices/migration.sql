-- Phase D: a default price multiplier per zone tier (Pricing page, Super Admin and Finance). A zone that follows its
-- tier keeps its priceMultiplier equal to the tier's; a zone with its own number keeps that. Every default starts at 1.0
-- and every existing zone keeps its own number (followsTier false), so no price changes when this is applied.
CREATE TABLE "TierPrice" (
    "tier" "ZoneTier" NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TierPrice_pkey" PRIMARY KEY ("tier"),
    CONSTRAINT "TierPrice_multiplier_range" CHECK ("multiplier" >= 0.5 AND "multiplier" <= 5)
);
INSERT INTO "TierPrice" ("tier", "multiplier") VALUES ('PREMIUM', 1.0), ('STANDARD', 1.0), ('BASIC', 1.0);
ALTER TABLE "TierPrice" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Zone" ADD COLUMN "followsTier" BOOLEAN NOT NULL DEFAULT false;
