-- Data expansion wave 1-5: new models and columns

-- ContaminatedSite: provincial GTC layer
ALTER TABLE "ContaminatedSite" ADD COLUMN "region" TEXT;
ALTER TABLE "ContaminatedSite" ADD COLUMN "sourceLayer" TEXT NOT NULL DEFAULT 'mtl';
CREATE INDEX "ContaminatedSite_sourceLayer_idx" ON "ContaminatedSite"("sourceLayer");
CREATE INDEX "ContaminatedSite_region_idx" ON "ContaminatedSite"("region");

-- ZoningPoint (PUM 2050 + regional zoning)
CREATE TABLE "ZoningPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Montréal',
    "borough" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "landUse" TEXT,
    "intensificationLevel" TEXT,
    "densityThreshold" REAL,
    "zoneCode" TEXT,
    "description" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ZoningPoint_externalId_key" ON "ZoningPoint"("externalId");
CREATE INDEX "ZoningPoint_latitude_longitude_idx" ON "ZoningPoint"("latitude", "longitude");
CREATE INDEX "ZoningPoint_city_idx" ON "ZoningPoint"("city");
CREATE INDEX "ZoningPoint_borough_idx" ON "ZoningPoint"("borough");

-- BoroughPermitDelay
CREATE TABLE "BoroughPermitDelay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "borough" TEXT NOT NULL,
    "phase" TEXT,
    "medianDays" REAL,
    "targetDays" REAL,
    "period" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BoroughPermitDelay_externalId_key" ON "BoroughPermitDelay"("externalId");
CREATE INDEX "BoroughPermitDelay_borough_idx" ON "BoroughPermitDelay"("borough");

-- DevelopmentProject (Sherbrooke etc.)
CREATE TABLE "DevelopmentProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "name" TEXT,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "borough" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "unitsPlanned" INTEGER,
    "projectUrl" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DevelopmentProject_externalId_key" ON "DevelopmentProject"("externalId");
CREATE INDEX "DevelopmentProject_city_idx" ON "DevelopmentProject"("city");
CREATE INDEX "DevelopmentProject_latitude_longitude_idx" ON "DevelopmentProject"("latitude", "longitude");

-- RoadWork city column
ALTER TABLE "RoadWork" ADD COLUMN "city" TEXT NOT NULL DEFAULT 'Montréal';
CREATE INDEX "RoadWork_city_idx" ON "RoadWork"("city");

-- TenderAward extensions
ALTER TABLE "TenderAward" ADD COLUMN "finalValue" REAL;
ALTER TABLE "TenderAward" ADD COLUMN "contractStatus" TEXT;
CREATE INDEX "TenderAward_winnerName_idx" ON "TenderAward"("winnerName");

-- SeaoAmendment
CREATE TABLE "SeaoAmendment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "contractId" TEXT,
    "tenderExternalId" TEXT,
    "title" TEXT,
    "amendmentType" TEXT,
    "amount" REAL,
    "amendedAt" DATETIME,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SeaoAmendment_externalId_key" ON "SeaoAmendment"("externalId");
CREATE INDEX "SeaoAmendment_tenderExternalId_idx" ON "SeaoAmendment"("tenderExternalId");
CREATE INDEX "SeaoAmendment_contractId_idx" ON "SeaoAmendment"("contractId");

-- OrgWebhook per-org filters
ALTER TABLE "OrgWebhook" ADD COLUMN "filters" TEXT;
