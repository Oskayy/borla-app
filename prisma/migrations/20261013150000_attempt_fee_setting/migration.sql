-- The attempt fee for a failed pickup that was the customer's fault becomes a pricing rule setting (0-25%).
-- Every existing rule, including the active one, starts at 0%: the customer gets everything back.
ALTER TABLE "PricingRule" ADD COLUMN "attemptFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
