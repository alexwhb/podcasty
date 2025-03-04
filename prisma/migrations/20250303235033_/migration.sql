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
    CONSTRAINT "Episode_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Episode" ("audioSize", "audioType", "audioUrl", "createdAt", "description", "duration", "episode", "episodeType", "explicit", "guid", "id", "isPublished", "link", "podcastId", "pubDate", "season", "title", "updatedAt") SELECT "audioSize", "audioType", "audioUrl", "createdAt", "description", "duration", "episode", "episodeType", "explicit", "guid", "id", "isPublished", "link", "podcastId", "pubDate", "season", "title", "updatedAt" FROM "Episode";
DROP TABLE "Episode";
ALTER TABLE "new_Episode" RENAME TO "Episode";
CREATE TABLE "new_Transcript" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentType" TEXT NOT NULL,
    "blob" BLOB NOT NULL,
    "episodeId" TEXT NOT NULL,
    CONSTRAINT "Transcript_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transcript" ("blob", "contentType", "episodeId", "id") SELECT "blob", "contentType", "episodeId", "id" FROM "Transcript";
DROP TABLE "Transcript";
ALTER TABLE "new_Transcript" RENAME TO "Transcript";
CREATE UNIQUE INDEX "Transcript_episodeId_key" ON "Transcript"("episodeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
