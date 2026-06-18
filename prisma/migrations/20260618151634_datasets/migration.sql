-- AlterTable
ALTER TABLE "Permit" ADD COLUMN "matricule" TEXT;

-- AlterTable
ALTER TABLE "Tender" ADD COLUMN "status" TEXT;

-- CreateTable
CREATE TABLE "PropertyUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "matricule" TEXT NOT NULL,
    "address" TEXT,
    "borough" TEXT,
    "landValue" REAL,
    "buildingValue" REAL,
    "totalValue" REAL,
    "landArea" REAL,
    "floors" INTEGER,
    "units" INTEGER,
    "yearBuilt" INTEGER,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PropertyTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "matricule" TEXT,
    "address" TEXT,
    "borough" TEXT,
    "salePrice" REAL,
    "saleDate" DATETIME,
    "buildingType" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ContaminatedSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "address" TEXT,
    "borough" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "status" TEXT,
    "description" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MunicipalSupplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "supplierNumber" TEXT,
    "name" TEXT NOT NULL,
    "neq" TEXT,
    "borough" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CommercialVacancy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "address" TEXT,
    "borough" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "vacancyType" TEXT,
    "areaSqm" REAL,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PropertyTax" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "matricule" TEXT,
    "borough" TEXT,
    "taxAmount" REAL,
    "year" INTEGER,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
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
    "isSupplier" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Company" ("capabilities", "certifications", "city", "createdAt", "email", "id", "name", "neq", "phone", "rbqNumber", "region", "sector", "sourceUrl") SELECT "capabilities", "certifications", "city", "createdAt", "email", "id", "name", "neq", "phone", "rbqNumber", "region", "sector", "sourceUrl" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE UNIQUE INDEX "Company_neq_key" ON "Company"("neq");
CREATE INDEX "Company_name_idx" ON "Company"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PropertyUnit_externalId_key" ON "PropertyUnit"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyUnit_matricule_key" ON "PropertyUnit"("matricule");

-- CreateIndex
CREATE INDEX "PropertyUnit_borough_idx" ON "PropertyUnit"("borough");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyTransaction_externalId_key" ON "PropertyTransaction"("externalId");

-- CreateIndex
CREATE INDEX "PropertyTransaction_matricule_idx" ON "PropertyTransaction"("matricule");

-- CreateIndex
CREATE INDEX "PropertyTransaction_borough_idx" ON "PropertyTransaction"("borough");

-- CreateIndex
CREATE UNIQUE INDEX "ContaminatedSite_externalId_key" ON "ContaminatedSite"("externalId");

-- CreateIndex
CREATE INDEX "ContaminatedSite_latitude_longitude_idx" ON "ContaminatedSite"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "ContaminatedSite_borough_idx" ON "ContaminatedSite"("borough");

-- CreateIndex
CREATE UNIQUE INDEX "MunicipalSupplier_externalId_key" ON "MunicipalSupplier"("externalId");

-- CreateIndex
CREATE INDEX "MunicipalSupplier_neq_idx" ON "MunicipalSupplier"("neq");

-- CreateIndex
CREATE INDEX "MunicipalSupplier_name_idx" ON "MunicipalSupplier"("name");

-- CreateIndex
CREATE INDEX "MunicipalSupplier_borough_idx" ON "MunicipalSupplier"("borough");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialVacancy_externalId_key" ON "CommercialVacancy"("externalId");

-- CreateIndex
CREATE INDEX "CommercialVacancy_borough_idx" ON "CommercialVacancy"("borough");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyTax_externalId_key" ON "PropertyTax"("externalId");

-- CreateIndex
CREATE INDEX "PropertyTax_matricule_idx" ON "PropertyTax"("matricule");

-- CreateIndex
CREATE INDEX "Permit_matricule_idx" ON "Permit"("matricule");

-- CreateIndex
CREATE INDEX "Permit_borough_idx" ON "Permit"("borough");

-- CreateIndex
CREATE INDEX "Tender_closesAt_idx" ON "Tender"("closesAt");

-- CreateIndex
CREATE INDEX "Tender_status_idx" ON "Tender"("status");
