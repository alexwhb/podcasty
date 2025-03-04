/*
  Warnings:

  - Added the required column `audioSize` to the `Episode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `audioType` to the `Episode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `audioUrl` to the `Episode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `link` to the `Episode` table without a default value. This is not possible if the table is not empty.

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
