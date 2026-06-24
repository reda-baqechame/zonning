ALTER TABLE "RbqLicense" ADD COLUMN "neq" TEXT;
CREATE TABLE "RenaRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "neq" TEXT,
    "name" TEXT,
    "status" TEXT,
    "offence" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "EnterpriseRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "neq" TEXT,
    "name" TEXT,
    "legalStatus" TEXT,
    "constitutionDate" DATETIME,
    "address" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "SanctionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "neq" TEXT,
    "name" TEXT,
    "law" TEXT,
    "amount" REAL,
    "date" DATETIME,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ConvictionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "neq" TEXT,
    "name" TEXT,
    "offence" TEXT,
    "date" DATETIME,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "InjuryClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employerName" TEXT,
    "neq" TEXT,
    "claimCount" INTEGER NOT NULL DEFAULT 0,
    "year" INTEGER,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "CadastreLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotNumber" TEXT,
    "city" TEXT,
    "geom" JSONB,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ZoningStandard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "city" TEXT,
    "zoneCode" TEXT,
    "allowedUses" JSONB,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "MarketIndex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "region" TEXT,
    "priceRange" TEXT,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "difficultyIndex" REAL,
    "period" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RenaRecord_neq_idx" ON "RenaRecord"("neq");
CREATE UNIQUE INDEX "EnterpriseRecord_neq_key" ON "EnterpriseRecord"("neq");
CREATE INDEX "SanctionRecord_neq_idx" ON "SanctionRecord"("neq");
CREATE INDEX "SanctionRecord_name_idx" ON "SanctionRecord"("name");
CREATE INDEX "ConvictionRecord_neq_idx" ON "ConvictionRecord"("neq");
CREATE INDEX "ConvictionRecord_name_idx" ON "ConvictionRecord"("name");
CREATE INDEX "InjuryClaim_neq_idx" ON "InjuryClaim"("neq");
CREATE INDEX "InjuryClaim_employerName_idx" ON "InjuryClaim"("employerName");
CREATE UNIQUE INDEX "CadastreLot_lotNumber_key" ON "CadastreLot"("lotNumber");
CREATE INDEX "ZoningStandard_city_zoneCode_idx" ON "ZoningStandard"("city", "zoneCode");
CREATE INDEX "MarketIndex_region_period_idx" ON "MarketIndex"("region", "period");
CREATE INDEX "RbqLicense_neq_idx" ON "RbqLicense"("neq");
