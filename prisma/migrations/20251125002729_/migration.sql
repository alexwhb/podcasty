/*
  Warnings:

  - Added the required column `slug` to the `Podcast` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Podcast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "generator" TEXT NOT NULL,
    "lastBuildDate" DATETIME NOT NULL,
    "language" TEXT NOT NULL,
    "copyright" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "explicit" BOOLEAN NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL,
    "license" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Podcast_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Podcast" ("author", "baseUrl", "category", "copyright", "createdAt", "description", "explicit", "generator", "guid", "id", "language", "lastBuildDate", "license", "link", "locked", "ownerId", "title", "type", "updatedAt") SELECT "author", "baseUrl", "category", "copyright", "createdAt", "description", "explicit", "generator", "guid", "id", "language", "lastBuildDate", "license", "link", "locked", "ownerId", "title", "type", "updatedAt" FROM "Podcast";
DROP TABLE "Podcast";
ALTER TABLE "new_Podcast" RENAME TO "Podcast";
CREATE UNIQUE INDEX "Podcast_slug_key" ON "Podcast"("slug");
CREATE INDEX "Podcast_ownerId_idx" ON "Podcast"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
