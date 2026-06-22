-- AlterTable
ALTER TABLE "SavedLead" ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'new';
ALTER TABLE "SavedLead" ADD COLUMN "nextActionAt" DATETIME;
ALTER TABLE "SavedLead" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "SavedLead_userId_stage_nextActionAt_idx" ON "SavedLead"("userId", "stage", "nextActionAt");
