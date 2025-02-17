// app/components/EpisodeImageUploader.tsx
import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface EpisodeImageUploaderProps {
  initialImageUrl?: string;
  onUpload: (imageUrl: string) => void;
  onRemove: () => void;
}

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png"];

export default function EpisodeImageUploader({
  initialImageUrl,
  onUpload,
  onRemove,
}: EpisodeImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(initialImageUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections?.length > 0) {
      setError("File rejected. Please select a JPEG or PNG file under 50 MB.");
      return;
    }
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setError(null);

    // Show preview first.
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    // Build form data for upload.
    const formData = new FormData();
    formData.append("episodeImage", file);

    try {
      const response = await fetch("/api/upload-episode-image", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success && data.imageUrl) {
        onUpload(data.imageUrl);
      } else {
        setError("Upload failed.");
      }
    } catch (err) {
      console.error("Upload error", err);
      setError("Upload error occurred.");
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: MAX_SIZE,
    accept: {
      "image/jpeg": [],
      "image/png": [],
    },
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className="border-dashed border-2 p-4 text-center cursor-pointer"
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the image here...</p>
        ) : (
          <p>Drag & drop an image here, or click to select one (JPEG, PNG; up to 50 MB)</p>
        )}
      </div>
      {uploading && <p className="text-blue-500">Uploading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {preview && (
        <div className="relative">
          <img src={preview} alt="Episode" className="max-w-full h-auto" />
          <button
            onClick={() => {
              setPreview(null);
              onRemove();
            }}
            className="absolute top-1 right-1 bg-white p-1 rounded-full shadow"
          >
            Remove Image
          </button>
        </div>
      )}
    </div>
  );
}
