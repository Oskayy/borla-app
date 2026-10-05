-- Only one payout rule and one pricing rule may be active at a time.
-- The app always used the newest active rule, so switching off the older "active" ones changes nothing in effect.
UPDATE "PayoutRule" SET "active" = false
WHERE "active" AND "id" <> (SELECT "id" FROM "PayoutRule" WHERE "active" ORDER BY "createdAt" DESC LIMIT 1);

UPDATE "PricingRule" SET "active" = false
WHERE "active" AND "id" <> (SELECT "id" FROM "PricingRule" WHERE "active" ORDER BY "createdAt" DESC LIMIT 1);

-- The database now refuses a second active rule.
CREATE UNIQUE INDEX "PayoutRule_one_active" ON "PayoutRule" ("active") WHERE "active";
CREATE UNIQUE INDEX "PricingRule_one_active" ON "PricingRule" ("active") WHERE "active";
