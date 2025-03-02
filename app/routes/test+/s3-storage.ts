import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { type StorageProvider } from "./types";

interface S3StorageConfig {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class S3Storage implements StorageProvider {
  private client: S3Client;
  private readonly bucket: string;
  private multipartUploads: Map<string, { uploadId: string; parts: { ETag: string; PartNumber: number }[] }>;

  constructor(config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region || "us-east-1",
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: !!config.endpoint,
    });
    this.bucket = config.bucket;
    this.multipartUploads = new Map();
  }

  async saveChunk(uploadId: string, chunkIndex: number, chunk: Buffer): Promise<void> {
    // Same as before
    let multipart = this.multipartUploads.get(uploadId);
    if (!multipart) {
      const response = await this.client.send(
        new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: `${uploadId}/file` })
      );
      multipart = { uploadId: response.UploadId!, parts: [] };
      this.multipartUploads.set(uploadId, multipart);
    }
    const partNumber = chunkIndex + 1;
    const response = await this.client.send(
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: `${uploadId}/file`,
        UploadId: multipart.uploadId,
        PartNumber: partNumber,
        Body: chunk,
      })
    );
    multipart.parts.push({ ETag: response.ETag!, PartNumber: partNumber });
  }

  async assembleFile(uploadId: string, fileName: string, totalChunks: number): Promise<void> {
    const multipart = this.multipartUploads.get(uploadId);
    if (!multipart || multipart.parts.length !== totalChunks) throw new Error("Multipart upload incomplete");
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: fileName,
        UploadId: multipart.uploadId,
        MultipartUpload: { Parts: multipart.parts.sort((a, b) => a.PartNumber - b.PartNumber) },
      })
    );
    this.multipartUploads.delete(uploadId);
  }

  async getFile(fileName: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: fileName })
    );
    const body = await response.Body?.transformToByteArray();
    if (!body) throw new Error(`File ${fileName} not found in S3`);
    return Buffer.from(body);
  }

  async cleanup(uploadId: string): Promise<void> {
    // List all objects with the uploadId prefix
    const listResponse = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${uploadId}/`,
      })
    );

    const objects = listResponse.Contents?.map((obj) => ({ Key: obj.Key })) || [];
    if (objects.length > 0) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: objects },
        })
      );
    }
  }
}