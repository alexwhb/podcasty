/*
  Warnings:

  - You are about to drop the column `audioSize` on the `Episode` table. All the data in the column will be lost.
  - You are about to drop the column `audioType` on the `Episode` table. All the data in the column will be lost.
  - You are about to drop the column `audioUrl` on the `Episode` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Episode` table. All the data in the column will be lost.
  - You are about to drop the column `link` on the `Episode` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "EpisodeImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentType" TEXT NOT NULL,
    "blob" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "episodeId" TEXT NOT NULL,
    CONSTRAINT "EpisodeImage_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "pubDate" DATETIME NOT NULL,
    "duration" INTEGER NOT NULL,
    "episodeType" TEXT NOT NULL,
    "season" INTEGER,
    "episode" INTEGER,
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "transcriptUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "podcastId" TEXT NOT NULL,
    CONSTRAINT "Episode_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Episode" ("createdAt", "description", "duration", "episode", "episodeType", "explicit", "guid", "id", "isPublished", "podcastId", "pubDate", "season", "title", "transcriptUrl", "updatedAt") SELECT "createdAt", "description", "duration", "episode", "episodeType", "explicit", "guid", "id", "isPublished", "podcastId", "pubDate", "season", "title", "transcriptUrl", "updatedAt" FROM "Episode";
DROP TABLE "Episode";
ALTER TABLE "new_Episode" RENAME TO "Episode";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeImage_episodeId_key" ON "EpisodeImage"("episodeId");

-- CreateIndex
CREATE INDEX "EpisodeImage_episodeId_idx" ON "EpisodeImage"("episodeId");
