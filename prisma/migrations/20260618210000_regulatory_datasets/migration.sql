-- CreateTable
CREATE TABLE "RbqInfraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "holderName" TEXT,
    "description" TEXT,
    "infractionDate" DATETIME,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "RbqInfraction_externalId_key" ON "RbqInfraction"("externalId");
CREATE INDEX "RbqInfraction_licenseNumber_idx" ON "RbqInfraction"("licenseNumber");

CREATE TABLE "AmpAuthorization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "licenseNumber" TEXT NOT NULL,
    "holderName" TEXT,
    "ampClass" TEXT,
    "status" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AmpAuthorization_licenseNumber_key" ON "AmpAuthorization"("licenseNumber");

CREATE TABLE "MunicipalInspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "violationType" TEXT,
    "inspectedAt" DATETIME,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "MunicipalInspection_externalId_key" ON "MunicipalInspection"("externalId");
CREATE INDEX "MunicipalInspection_city_idx" ON "MunicipalInspection"("city");
