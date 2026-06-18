-- AlterTable
ALTER TABLE "User" ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "alertSmsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Permit" ADD COLUMN "summaryFr" TEXT;
ALTER TABLE "Permit" ADD COLUMN "summaryEn" TEXT;
ALTER TABLE "Permit" ADD COLUMN "summaryGeneratedAt" DATETIME;

-- CreateTable
CREATE TABLE "VerdictReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shareSlug" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "borough" TEXT,
    "tier" TEXT NOT NULL,
    "summaryFr" TEXT,
    "summaryEn" TEXT,
    "inputsJson" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "VerdictReport_shareSlug_key" ON "VerdictReport"("shareSlug");
CREATE INDEX "VerdictReport_address_idx" ON "VerdictReport"("address");
CREATE INDEX "VerdictReport_createdAt_idx" ON "VerdictReport"("createdAt");
