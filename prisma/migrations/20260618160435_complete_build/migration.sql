-- AlterTable
ALTER TABLE "SyncState" ADD COLUMN "cursor" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'EQUIPE',
    "ownerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT 'permits,tenders',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    CONSTRAINT "ApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConciergeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stripeSessionId" TEXT,
    "opportunities" TEXT,
    "notes" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConciergeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DigestSubscriber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "borough" TEXT,
    "trade" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PublicContractPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "awardDate" DATETIME,
    "invoiceDate" DATETIME,
    "paymentDue" DATETIME,
    "amount" REAL,
    "tenderAwardId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicContractPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "weekStart" DATETIME NOT NULL,
    CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RbqLicense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "licenseNumber" TEXT NOT NULL,
    "holderName" TEXT,
    "subclass" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiryDate" DATETIME,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tender" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "organization" TEXT,
    "category" TEXT,
    "region" TEXT,
    "estimatedValue" REAL,
    "publishedAt" DATETIME,
    "closesAt" DATETIME,
    "summary" TEXT,
    "aiSummary" TEXT,
    "summaryGeneratedAt" DATETIME,
    "description" TEXT,
    "requiresAmp" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT NOT NULL,
    "unspsc" TEXT,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Tender" ("category", "closesAt", "createdAt", "estimatedValue", "externalId", "id", "organization", "publishedAt", "region", "sourceUrl", "status", "summary", "title", "unspsc") SELECT "category", "closesAt", "createdAt", "estimatedValue", "externalId", "id", "organization", "publishedAt", "region", "sourceUrl", "status", "summary", "title", "unspsc" FROM "Tender";
DROP TABLE "Tender";
ALTER TABLE "new_Tender" RENAME TO "Tender";
CREATE UNIQUE INDEX "Tender_externalId_key" ON "Tender"("externalId");
CREATE INDEX "Tender_closesAt_idx" ON "Tender"("closesAt");
CREATE INDEX "Tender_status_idx" ON "Tender"("status");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "companyName" TEXT,
    "rbqLicenseClass" TEXT,
    "rbqLicenseNumber" TEXT,
    "rbqVerified" BOOLEAN NOT NULL DEFAULT false,
    "rbqVerifiedAt" DATETIME,
    "trades" TEXT,
    "regions" TEXT,
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "ampAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "minProjectCost" REAL,
    "maxProjectCost" REAL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastDigestAt" DATETIME
);
INSERT INTO "new_User" ("companyName", "createdAt", "email", "id", "lastDigestAt", "name", "passwordHash", "plan", "rbqLicenseClass", "rbqLicenseNumber", "regions", "stripeCustomerId", "stripeSubscriptionId", "trades", "updatedAt") SELECT "companyName", "createdAt", "email", "id", "lastDigestAt", "name", "passwordHash", "plan", "rbqLicenseClass", "rbqLicenseNumber", "regions", "stripeCustomerId", "stripeSubscriptionId", "trades", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_ownerId_key" ON "Organization"("ownerId");

-- CreateIndex
CREATE INDEX "OrgMember_userId_idx" ON "OrgMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_orgId_userId_key" ON "OrgMember"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "ConciergeRequest_userId_key" ON "ConciergeRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DigestSubscriber_email_key" ON "DigestSubscriber"("email");

-- CreateIndex
CREATE INDEX "PublicContractPayment_userId_idx" ON "PublicContractPayment"("userId");

-- CreateIndex
CREATE INDEX "UsageCounter_userId_idx" ON "UsageCounter"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_key_weekStart_key" ON "UsageCounter"("userId", "key", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "RbqLicense_licenseNumber_key" ON "RbqLicense"("licenseNumber");

-- CreateIndex
CREATE INDEX "RbqLicense_subclass_idx" ON "RbqLicense"("subclass");

-- CreateIndex
CREATE INDEX "RbqLicense_status_idx" ON "RbqLicense"("status");

-- CreateIndex
CREATE INDEX "Permit_city_idx" ON "Permit"("city");

-- CreateIndex
CREATE INDEX "Permit_issueDate_idx" ON "Permit"("issueDate");
