-- Admin-approved anonymising of records older than 6 years (by calendar year).
CREATE TABLE "RecordsRetentionRun" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "finishedAt" TIMESTAMP(3),
    "summary" TEXT,
    CONSTRAINT "RecordsRetentionRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecordsRetentionRun_year_idx" ON "RecordsRetentionRun"("year");

-- Same as every other table: only the app (which bypasses RLS) reads it.
ALTER TABLE "RecordsRetentionRun" ENABLE ROW LEVEL SECURITY;
