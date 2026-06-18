-- AlterTable
PRAGMA foreign_keys=OFF;

CREATE TABLE "DatasetQualityCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "rowsIngested" INTEGER NOT NULL DEFAULT 0,
    "rowsInDb" INTEGER,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "message" TEXT,
    "sourceModifiedAt" DATETIME,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DatasetQualityCheck_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "SyncState" ("datasetId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DatasetQualityCheck_datasetId_checkedAt_idx" ON "DatasetQualityCheck"("datasetId", "checkedAt");
CREATE INDEX "DatasetQualityCheck_status_idx" ON "DatasetQualityCheck"("status");

CREATE TABLE "OrgWebhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT NOT NULL DEFAULT 'permit.created,tender.created',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgWebhook_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OrgWebhook_orgId_idx" ON "OrgWebhook"("orgId");

CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "OrgWebhook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WebhookDelivery_webhookId_idx" ON "WebhookDelivery"("webhookId");
CREATE INDEX "WebhookDelivery_status_idx" ON "WebhookDelivery"("status");

PRAGMA foreign_keys=ON;
