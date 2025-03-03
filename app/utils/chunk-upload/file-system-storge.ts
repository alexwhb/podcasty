import { writeFileSync, appendFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { rmSync } from 'node:fs'
import { join } from "path";
import { type StorageProvider } from "./types";

export class FileSystemStorage implements StorageProvider {
  private readonly baseDir: string;

  constructor(baseDir: string = join(process.cwd(), "uploads")) {
    this.baseDir = baseDir;
    console.log("baseDir", baseDir)
  }

  async saveChunk(uploadId: string, chunkIndex: number, chunk: Buffer): Promise<void> {
    const uploadDir = join(this.baseDir, uploadId);
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    const chunkPath = join(uploadDir, `chunk-${chunkIndex}`);
    writeFileSync(chunkPath, chunk);
  }

  async assembleFile(uploadId: string, fileName: string, totalChunks: number): Promise<void> {
    const finalPath = join(this.baseDir, fileName);
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = join(this.baseDir, uploadId, `chunk-${i}`);
      const chunkData = readFileSync(chunkPath);
      appendFileSync(finalPath, chunkData);
    }
    // clean up folder with chunks
    rmSync(join(this.baseDir, uploadId), { recursive: true, force: true });
  }

  async getFile(fileName: string): Promise<Buffer> {
    const filePath = join(this.baseDir, fileName);
    if (!existsSync(filePath)) throw new Error(`File ${fileName} not found`);
    return readFileSync(filePath);
  }

  async cleanup(uploadId: string): Promise<void> {
    const uploadDir = join(this.baseDir, uploadId);
    if (existsSync(uploadDir)) {
      rmSync(uploadDir, { recursive: true, force: true });
    }
  }
}