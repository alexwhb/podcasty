import { type ChangeEvent, useState } from 'react'
import { calculateTotalChunks, getChunk, UploadChunkSchema } from '#app/utils/chunk-upload/upload-utils.ts';

type ResponseData =
  | { status: 'chunk_uploaded'; chunkIndex: number }
  | { status: 'complete'; fileName: string; audioUrl: string }
  | { status: 'error'; error: string };

export type UploadComplete = Extract<ResponseData, { status: 'complete' }>;

export function useChunkUploader({ username, podcastId }: { username: string; podcastId: string }) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadComplete, setUploadComplete] = useState<UploadComplete | null>(null);
  const basePath = `/users/${username}/podcasts/${podcastId}/upload`;

  async function checkResumeStatus(uploadId: string) {
    const response = await fetch(`${basePath}/resume?uploadId=${encodeURIComponent(uploadId)}`);
    if (!response.ok) return [];
    const data = await response.json() as { uploadedChunks?: number[] };
    return data.uploadedChunks ?? [];
  }

  async function uploadChunk(chunkData: Record<string, string | number | Blob>) {
    const formData = new FormData();
    Object.entries(chunkData).forEach(([key, value]) =>
      formData.append(key, value instanceof Blob ? value : String(value)),
    );
    const response = await fetch(`${basePath}/chunk`, { method: "POST", body: formData });
    const responseData = await response.json().catch(() => null) as ResponseData | null;
    if (!response.ok || !responseData || responseData.status === 'error') {
      throw new Error(responseData?.status === 'error' ? responseData.error : "Chunk upload failed");
    }
    if (responseData.status === "complete") {
      setUploadComplete(responseData);
    }
    return responseData;
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setProgress(0);
    setError(null);
    setUploadComplete(null);
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError("Please select a file first");
      return;
    }

    setError(null);
    const uploadId = crypto.randomUUID();
    const totalChunks = calculateTotalChunks(selectedFile.size);
    const uploadedChunks = await checkResumeStatus(uploadId);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (uploadedChunks.includes(chunkIndex)) {
        setProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));
        continue;
      }

      const chunk = getChunk(selectedFile, chunkIndex);
      const chunkData = { chunk, uploadId, chunkIndex, totalChunks, fileName: selectedFile.name };

      const validation = UploadChunkSchema.safeParse(chunkData);
      if (!validation.success) {
        setError(validation.error.errors[0]?.message || "Invalid upload data");
        return;
      }

      try {
        await uploadChunk(chunkData);
        setProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));
      } catch (err) {
        console.error("Upload failed at chunk", chunkIndex, err);
        setError(err instanceof Error ? err.message : "Upload interrupted. Please try again.");
        break;
      }
    }
  }

  return {
    progress,
    error,
    selectedFile,
    uploadComplete,
    handleFileChange,
    handleUpload,
  };
}
