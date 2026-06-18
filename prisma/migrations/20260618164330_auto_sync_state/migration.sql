-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "lastSuccessAt" DATETIME,
    "lastRunAt" DATETIME,
    "lastError" TEXT,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "cursor" TEXT,
    "sourceModifiedAt" DATETIME,
    "syncOffset" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SyncState" ("cursor", "datasetId", "id", "lastError", "lastRunAt", "lastSuccessAt", "recordsProcessed", "status", "updatedAt") SELECT "cursor", "datasetId", "id", "lastError", "lastRunAt", "lastSuccessAt", "recordsProcessed", "status", "updatedAt" FROM "SyncState";
DROP TABLE "SyncState";
ALTER TABLE "new_SyncState" RENAME TO "SyncState";
CREATE UNIQUE INDEX "SyncState_datasetId_key" ON "SyncState"("datasetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
