export interface StorageProvider {
  saveChunk(uploadId: string, chunkIndex: number, chunk: Buffer): Promise<void>;
  assembleFile(uploadId: string, fileName: string, totalChunks: number): Promise<void>;
  getFile(fileName: string): Promise<Buffer>; // New method to retrieve the file
  cleanup(uploadId: string): Promise<void>; // New method for cleanup
}