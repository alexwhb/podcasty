import { type ChangeEvent, useState } from 'react'
import { calculateTotalChunks, getChunk, UploadChunkSchema } from '#app/utils/chunk-upload/upload-utils.ts';

type ResponseData = {
  status: string;
  file?: string;
  metadata?: any;
};

export function useChunkUploader() {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadComplete, setUploadComplete] = useState<ResponseData | null>(null);

  async function checkResumeStatus(uploadId: string) {
    const response = await fetch(`/test/upload/resume?uploadId=${uploadId}`);
    const data = await response.json() as { uploadedChunks: number[] };
    return data.uploadedChunks || [];
  }

  async function uploadChunk(chunkData: any) {
    const formData = new FormData();
    Object.entries(chunkData).forEach(([key, value]) => formData.append(key, value as any));
    const response = await fetch("/test/upload/chunk", { method: "POST", body: formData });
    if (!response.ok) throw new Error("Chunk upload failed");

    const responseData = await response.json() as ResponseData;
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

    const uploadId = `${selectedFile.name}-${Date.now()}`;
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
        setError("Upload interrupted. Please try resuming.");
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