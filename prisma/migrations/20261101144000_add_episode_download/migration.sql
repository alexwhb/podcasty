-- IF NOT EXISTS because this table was created by hand on the production
-- database on 2026-11-01, before any image containing this migration existed.

-- CreateTable
CREATE TABLE IF NOT EXISTS "EpisodeDownload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "episodeId" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "referer" TEXT,
    "range" TEXT,
    CONSTRAINT "EpisodeDownload_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EpisodeDownload_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EpisodeDownload_episodeId_createdAt_idx" ON "EpisodeDownload"("episodeId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EpisodeDownload_podcastId_createdAt_idx" ON "EpisodeDownload"("podcastId", "createdAt");
