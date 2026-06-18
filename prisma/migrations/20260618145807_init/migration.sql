-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "companyName" TEXT,
    "rbqLicenseClass" TEXT,
    "rbqLicenseNumber" TEXT,
    "trades" TEXT,
    "regions" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Permit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "permitNumber" TEXT,
    "permitType" TEXT NOT NULL,
    "workType" TEXT,
    "borough" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Montréal',
    "latitude" REAL,
    "longitude" REAL,
    "estimatedCost" REAL,
    "issueDate" DATETIME,
    "applicantName" TEXT,
    "applicantContact" TEXT,
    "requiredRbqClasses" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Tender" (
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
    "sourceUrl" TEXT NOT NULL,
    "unspsc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "neq" TEXT,
    "city" TEXT,
    "region" TEXT,
    "sector" TEXT,
    "certifications" TEXT,
    "capabilities" TEXT,
    "rbqNumber" TEXT,
    "sourceUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AlertSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL,
    "lawfulBasis" TEXT NOT NULL DEFAULT 'conspicuous_publication',
    "certificateIssuedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComplianceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationInterview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "interviewerName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "q1Pipeline" TEXT,
    "q2RbqPain" TEXT,
    "q3SeaoHours" TEXT,
    "q4WouldPay" TEXT,
    "wouldPayAmount" INTEGER,
    "urgencyScore" INTEGER,
    "notes" TEXT,
    "interviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationInterview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsProcessed" INTEGER NOT NULL,
    "error" TEXT,
    "ranAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Permit_externalId_key" ON "Permit"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Tender_externalId_key" ON "Tender"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_neq_key" ON "Company"("neq");
