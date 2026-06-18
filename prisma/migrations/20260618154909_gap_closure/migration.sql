-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastDigestAt" DATETIME;

-- CreateTable
CREATE TABLE "TenderAward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "title" TEXT,
    "winnerName" TEXT,
    "buyerName" TEXT,
    "awardAmount" REAL,
    "unspsc" TEXT,
    "category" TEXT,
    "region" TEXT,
    "awardDate" DATETIME,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BoroughZoning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "borough" TEXT NOT NULL,
    "densityZone" TEXT,
    "maxFloors" INTEGER,
    "description" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TenderAward_externalId_key" ON "TenderAward"("externalId");

-- CreateIndex
CREATE INDEX "TenderAward_unspsc_idx" ON "TenderAward"("unspsc");

-- CreateIndex
CREATE INDEX "TenderAward_category_idx" ON "TenderAward"("category");

-- CreateIndex
CREATE UNIQUE INDEX "BoroughZoning_borough_key" ON "BoroughZoning"("borough");

-- CreateIndex
CREATE INDEX "EmailLog_userId_idx" ON "EmailLog"("userId");

-- CreateIndex
CREATE INDEX "EmailLog_type_idx" ON "EmailLog"("type");
