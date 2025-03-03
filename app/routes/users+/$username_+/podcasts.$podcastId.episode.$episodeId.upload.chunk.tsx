
import { type ActionFunctionArgs, data } from 'react-router'

import { getAudioMetadata } from '#app/utils/chunk-upload/audio-metadata.service.ts'
import { FileSystemStorage } from '#app/utils/chunk-upload/file-system-storge.ts'
import { S3Storage } from '#app/utils/chunk-upload/s3-storage.ts'
import { type StorageProvider } from '#app/utils/chunk-upload/types.ts'
import { UploadChunkSchema } from '#app/utils/chunk-upload/upload-utils.ts'
import { prisma } from '#app/utils/db.server.ts'


const storageProvider: StorageProvider = process.env.USE_S3
  ? new S3Storage({
    bucket: process.env.S3_BUCKET!,
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  })
  : new FileSystemStorage();

/**
 * Records a chunk of an uploaded file in the database
 * @param uploadId - Unique identifier for the upload
 * @param chunkIndex - Index number of the current chunk
 * @param fileName - Name of the file being uploaded
 * @param totalChunks - Total number of chunks expected for this upload
 */
async function recordChunkInDb(uploadId: string, chunkIndex: number, fileName: string, totalChunks: number) {
  console.log("recordChunkInDb", uploadId, chunkIndex, fileName, totalChunks);

  await prisma.upload.upsert({
    where: { id: uploadId },
    update: { uploadedChunks: { create: { chunkIndex } } },
    create: {
      id: uploadId,
      fileName,
      totalChunks,
      uploadedChunks: { create: { chunkIndex } },
    },
  });
}

/**
 * Checks if all chunks of a file upload have been received
 * @param uploadId - The unique identifier of the upload
 * @param totalChunks - The total number of chunks expected for this upload
 * @returns Promise that resolves to true if all chunks are uploaded, false otherwise
 */
async function isUploadComplete(uploadId: string, totalChunks: number): Promise<boolean> {
  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: { uploadedChunks: true },
  });
  return upload?.uploadedChunks.length === totalChunks;
}

/**
 * Handles the upload of a chunk of a file
 * @param request - The HTTP request object
 * @returns Promise that resolves to a response object
 */
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const rawData = Object.fromEntries(formData);

  const validation = UploadChunkSchema.safeParse(rawData);
  if (!validation.success) {
    console.log("Validation errors:", validation.error.errors);
    return data(
      { result: { status: 'error', errors: validation.error.errors } },
      { status: 400 }
    );
  }

  const { chunk, uploadId, chunkIndex, totalChunks, fileName } = validation.data;
  
  try {
    await storageProvider.saveChunk(uploadId, chunkIndex, Buffer.from(await chunk.arrayBuffer()));
    await recordChunkInDb(uploadId, chunkIndex, fileName, totalChunks);

    if (await isUploadComplete(uploadId, totalChunks)) {
      await storageProvider.assembleFile(uploadId, fileName, totalChunks);
      const metadata = await getAudioMetadata(fileName, storageProvider);
      console.log("isUploadComplete", uploadId, totalChunks, metadata);

      return data({ status: "complete", file: fileName, metadata });
    }

    return data({ status: "chunk_uploaded", chunkIndex });
  } catch (error) {
    console.error("Upload error:", error);
    return data(
      { result: { status: 'error', errors: [{ message: 'Upload failed' }] } },
      { status: 500 }
    );
  }
}