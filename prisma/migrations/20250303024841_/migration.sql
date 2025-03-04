/*
  Warnings:

  - You are about to drop the column `transcriptUrl` on the `Episode` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "audioSize" INTEGER NOT NULL,
    "audioType" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "pubDate" DATETIME NOT NULL,
    "duration" INTEGER NOT NULL,
    "episodeType" TEXT NOT NULL,
    "season" INTEGER,
    "episode" INTEGER,
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "podcastId" TEXT NOT NULL,
    CONSTRAINT "Episode_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Episode" ("audioSize", "audioType", "audioUrl", "createdAt", "description", "duration", "episode", "episodeType", "explicit", "guid", "id", "isPublished", "link", "podcastId", "pubDate", "season", "title", "updatedAt") SELECT "audioSize", "audioType", "audioUrl", "createdAt", "description", "duration", "episode", "episodeType", "explicit", "guid", "id", "isPublished", "link", "podcastId", "pubDate", "season", "title", "updatedAt" FROM "Episode";
DROP TABLE "Episode";
ALTER TABLE "new_Episode" RENAME TO "Episode";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
