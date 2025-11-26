-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EpisodeImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentType" TEXT,
    "blob" BLOB,
    "objectKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "episodeId" TEXT NOT NULL,
    CONSTRAINT "EpisodeImage_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EpisodeImage" ("blob", "contentType", "createdAt", "episodeId", "id", "updatedAt") SELECT "blob", "contentType", "createdAt", "episodeId", "id", "updatedAt" FROM "EpisodeImage";
DROP TABLE "EpisodeImage";
ALTER TABLE "new_EpisodeImage" RENAME TO "EpisodeImage";
CREATE UNIQUE INDEX "EpisodeImage_episodeId_key" ON "EpisodeImage"("episodeId");
CREATE INDEX "EpisodeImage_episodeId_idx" ON "EpisodeImage"("episodeId");
CREATE TABLE "new_NoteImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "contentType" TEXT,
    "blob" BLOB,
    "objectKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "noteId" TEXT NOT NULL,
    CONSTRAINT "NoteImage_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NoteImage" ("altText", "blob", "contentType", "createdAt", "id", "noteId", "updatedAt") SELECT "altText", "blob", "contentType", "createdAt", "id", "noteId", "updatedAt" FROM "NoteImage";
DROP TABLE "NoteImage";
ALTER TABLE "new_NoteImage" RENAME TO "NoteImage";
CREATE INDEX "NoteImage_noteId_idx" ON "NoteImage"("noteId");
CREATE TABLE "new_PodcastImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentType" TEXT,
    "blob" BLOB,
    "objectKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "podcastId" TEXT NOT NULL,
    CONSTRAINT "PodcastImage_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PodcastImage" ("blob", "contentType", "createdAt", "id", "podcastId", "updatedAt") SELECT "blob", "contentType", "createdAt", "id", "podcastId", "updatedAt" FROM "PodcastImage";
DROP TABLE "PodcastImage";
ALTER TABLE "new_PodcastImage" RENAME TO "PodcastImage";
CREATE UNIQUE INDEX "PodcastImage_podcastId_key" ON "PodcastImage"("podcastId");
CREATE INDEX "PodcastImage_podcastId_idx" ON "PodcastImage"("podcastId");
CREATE TABLE "new_UserImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "contentType" TEXT,
    "blob" BLOB,
    "objectKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "UserImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserImage" ("altText", "blob", "contentType", "createdAt", "id", "updatedAt", "userId") SELECT "altText", "blob", "contentType", "createdAt", "id", "updatedAt", "userId" FROM "UserImage";
DROP TABLE "UserImage";
ALTER TABLE "new_UserImage" RENAME TO "UserImage";
CREATE UNIQUE INDEX "UserImage_userId_key" ON "UserImage"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
