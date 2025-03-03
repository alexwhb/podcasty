import { type ChangeEvent, useEffect } from 'react'
import { Form } from 'react-router';
import { Button } from '#app/components/ui/button';
import { Input } from '#app/components/ui/input';
import { Progress } from '#app/components/ui/progress';

type ResponseData = {
  status: string;
  file?: string;
  metadata?: any;
};

type UploaderProps = {
  progress: number;
  error: string | null;
  selectedFile: File | null;
  uploadComplete: ResponseData | null;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => void;
  onUploadComplete?: (file: string) => void; // Optional callback for integration
};

export default function Uploader({
                                   progress,
                                   error,
                                   selectedFile,
                                   uploadComplete,
                                   handleFileChange,
                                   handleUpload,
                                   onUploadComplete,
                                 }: UploaderProps) {
  useEffect(() => {
    if (uploadComplete?.status === "complete" && uploadComplete.file) {
      onUploadComplete?.(uploadComplete.file);
    }
  }, [uploadComplete, onUploadComplete]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Upload Audio File</h1>
      <Form onSubmit={(e) => { e.preventDefault(); handleUpload(); }} className="space-y-4">
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
          <p className="text-sm text-green-600">Upload Complete: {uploadComplete.file}</p>
        </div>
      )}
    </div>
  );
}