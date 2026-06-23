-- Foundation for parcel-aware zoning lookups. ZoningPolygon remains the only
-- confirmed zoning source; ParcelPoint and AddressGeocode prepare the lookup
-- path, while ZoningRegulationLink stores official bylaw/schedule links.

CREATE TABLE "ParcelPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "borough" TEXT,
    "address" TEXT,
    "matricule" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ParcelPoint_externalId_key" ON "ParcelPoint"("externalId");
CREATE INDEX "ParcelPoint_city_idx" ON "ParcelPoint"("city");
CREATE INDEX "ParcelPoint_borough_idx" ON "ParcelPoint"("borough");
CREATE INDEX "ParcelPoint_matricule_idx" ON "ParcelPoint"("matricule");
CREATE INDEX "ParcelPoint_latitude_longitude_idx" ON "ParcelPoint"("latitude", "longitude");

CREATE TABLE "AddressGeocode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queryHash" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "normalizedAddress" TEXT,
    "city" TEXT,
    "borough" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "confidence" REAL,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "AddressGeocode_queryHash_key" ON "AddressGeocode"("queryHash");
CREATE INDEX "AddressGeocode_city_idx" ON "AddressGeocode"("city");
CREATE INDEX "AddressGeocode_borough_idx" ON "AddressGeocode"("borough");
CREATE INDEX "AddressGeocode_latitude_longitude_idx" ON "AddressGeocode"("latitude", "longitude");

CREATE TABLE "ZoningRegulationLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "city" TEXT NOT NULL,
    "borough" TEXT,
    "zoneCode" TEXT,
    "title" TEXT,
    "regulationUrl" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ZoningRegulationLink_city_idx" ON "ZoningRegulationLink"("city");
CREATE INDEX "ZoningRegulationLink_borough_idx" ON "ZoningRegulationLink"("borough");
CREATE INDEX "ZoningRegulationLink_zoneCode_idx" ON "ZoningRegulationLink"("zoneCode");
