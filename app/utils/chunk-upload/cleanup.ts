import { type StorageProvider } from '#app/routes/test+/types.ts'
import { prisma } from '#app/utils/db.server.ts'

// TODO hook me up to some sort of cron.

const EXPIRATION_TIME_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function cleanupExpiredUploads(storage: StorageProvider): Promise<number> {
  const expirationDate = new Date(Date.now() - EXPIRATION_TIME_MS);

  // Find uploads older than the expiration time
  const expiredUploads = await prisma.upload.findMany({
    where: {
      updatedAt: { lte: expirationDate },
      uploadedChunks: { some: {} }, // Only clean up uploads with chunks
    },
    include: { uploadedChunks: true },
  });

  // Clean up each expired upload
  for (const upload of expiredUploads) {
    if (upload.uploadedChunks.length < upload.totalChunks) {
      // Incomplete upload: clean up chunks and DB records
      await storage.cleanup(upload.id);
      await prisma.uploadChunk.deleteMany({ where: { uploadId: upload.id } });
      await prisma.upload.delete({ where: { id: upload.id } });
    }
  }

  return expiredUploads.length;
}