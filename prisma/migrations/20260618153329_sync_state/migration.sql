-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "datasetId" TEXT NOT NULL,
    "lastSuccessAt" DATETIME,
    "lastRunAt" DATETIME,
    "lastError" TEXT,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_datasetId_key" ON "SyncState"("datasetId");
