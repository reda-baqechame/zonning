-- CreateTable
CREATE TABLE "HeritageSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "name" TEXT,
    "address" TEXT,
    "borough" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "category" TEXT,
    "status" TEXT,
    "description" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MunicipalContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "supplierName" TEXT,
    "description" TEXT,
    "amount" REAL,
    "service" TEXT,
    "borough" TEXT,
    "approvedAt" DATETIME,
    "contractNumber" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RoadWork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "borough" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BoroughPermitStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "borough" TEXT NOT NULL,
    "permitType" TEXT,
    "period" TEXT,
    "permitCount" INTEGER,
    "estimatedCost" REAL,
    "permitCost" REAL,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "HeritageSite_externalId_key" ON "HeritageSite"("externalId");

-- CreateIndex
CREATE INDEX "HeritageSite_latitude_longitude_idx" ON "HeritageSite"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "HeritageSite_borough_idx" ON "HeritageSite"("borough");

-- CreateIndex
CREATE UNIQUE INDEX "MunicipalContract_externalId_key" ON "MunicipalContract"("externalId");

-- CreateIndex
CREATE INDEX "MunicipalContract_supplierName_idx" ON "MunicipalContract"("supplierName");

-- CreateIndex
CREATE INDEX "MunicipalContract_borough_idx" ON "MunicipalContract"("borough");

-- CreateIndex
CREATE UNIQUE INDEX "RoadWork_externalId_key" ON "RoadWork"("externalId");

-- CreateIndex
CREATE INDEX "RoadWork_borough_idx" ON "RoadWork"("borough");

-- CreateIndex
CREATE INDEX "RoadWork_latitude_longitude_idx" ON "RoadWork"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "BoroughPermitStat_externalId_key" ON "BoroughPermitStat"("externalId");

-- CreateIndex
CREATE INDEX "BoroughPermitStat_borough_idx" ON "BoroughPermitStat"("borough");
