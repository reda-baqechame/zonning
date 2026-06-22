-- CreateTable
CREATE TABLE "ZoningPolygon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "borough" TEXT,
    "zoneCode" TEXT,
    "landUse" TEXT,
    "regulationUrl" TEXT,
    "minLat" REAL,
    "maxLat" REAL,
    "minLng" REAL,
    "maxLng" REAL,
    "geometryJson" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceFetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProcessedStripeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "metadata" TEXT,
    "ip" TEXT,
    "requestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ZoningPolygon_externalId_key" ON "ZoningPolygon"("externalId");

-- CreateIndex
CREATE INDEX "ZoningPolygon_city_idx" ON "ZoningPolygon"("city");

-- CreateIndex
CREATE INDEX "ZoningPolygon_zoneCode_idx" ON "ZoningPolygon"("zoneCode");

-- CreateIndex
CREATE INDEX "ZoningPolygon_minLat_maxLat_idx" ON "ZoningPolygon"("minLat", "maxLat");

-- CreateIndex
CREATE INDEX "ProcessedStripeEvent_createdAt_idx" ON "ProcessedStripeEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
