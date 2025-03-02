import React, { useState } from "react";
import { useActionData, Form } from "react-router";
import { Button } from "#app/components/ui/button";
import { Input } from "#app/components/ui/input";
import { Progress } from "#app/components/ui/progress";
import { calculateTotalChunks, getChunk, UploadChunkSchema } from "#app/routes/test+/upload-utils";

export default function UploadPage() {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadComplete, setUploadComplete] = useState<{
    status: string;
    file?: string;
    metadata?: any;
  } | null>(null);

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
    const responseData = await response.json();
    
    if (responseData.status === "complete") {
      setUploadComplete(responseData);
    }
    return responseData;
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setProgress(0);
    setError(null);
    setUploadComplete(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Upload Podcast Audio</h1>
      <Form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="file"
          accept=".mp3,.wav,.aac,.m4a"
          onChange={handleFileChange}
          className="w-full"
        />
        <Button type="submit" disabled={!selectedFile}>
          Start Upload
        </Button>
      </Form>

      {selectedFile && (
        <p className="text-sm text-gray-600">Selected: {selectedFile.name}</p>
      )}

      {progress > 0 && uploadComplete?.status !== "complete" && (
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-gray-600">Progress: {progress}%</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {uploadComplete?.status === "complete" && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Upload Complete</h2>
          <p className="text-sm">File: {uploadComplete.file}</p>

        </div>
      )}
    </div>
  );
}