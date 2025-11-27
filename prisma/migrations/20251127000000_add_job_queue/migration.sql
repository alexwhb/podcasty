-- Create JobStatus enum is represented as TEXT in SQLite
CREATE TABLE "Job" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "payload" TEXT NOT NULL,
  "result" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "Job_status_type_createdAt_idx" ON "Job" ("status", "type", "createdAt");
