-- Whether the app may send driver payouts through Paystack. Off until the Paystack account can make transfers
-- (a Starter Business account can't); while off, payouts wait on the Withdrawals page for Finance to pay by hand.
ALTER TABLE "OperatingSettings" ADD COLUMN "paystackTransfers" BOOLEAN NOT NULL DEFAULT false;
