import { parseBuffer } from "music-metadata"; // Import from the library
import { type StorageProvider } from '#app/routes/test+/types.ts'

export interface PodcastAudioMetadata {
  durationMs: number; // Duration in milliseconds
  fileSize: number; // Size in bytes
  format: string; // e.g., "mp3", "wav"
  bitrate?: number; // Bitrate in bps (optional)
}

export async function getAudioMetadata(
  fileName: string,
  storage: StorageProvider
): Promise<PodcastAudioMetadata> {
  const fileBuffer = await storage.getFile(fileName);

  try {
    const metadata = await parseBuffer(fileBuffer, fileName, { duration: true });
    return {
      durationMs: Math.round(metadata.format.duration! * 1000), // Convert seconds to milliseconds
      fileSize: fileBuffer.length,
      format: metadata.format.container?.toLowerCase() || fileName.split(".").pop() || "unknown",
      bitrate: metadata.format.bitrate
    };
  } catch (error: unknown) {
    if(error instanceof Error) {
      throw new Error(`Failed to parse audio metadata: ${error.message}`);
    }
    throw new Error(`Failed to parse audio metadata: ${error}`);
  }
}