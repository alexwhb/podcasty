import { type ChangeEvent, useEffect } from 'react'
import { Button } from '#app/components/ui/button';
import { Input } from '#app/components/ui/input';
import { Progress } from '#app/components/ui/progress';
import { Label } from '#app/components/ui/label.tsx'

import { type UploadComplete } from '#app/hooks/use-chunk-uploader.ts'

type UploaderProps = {
  progress: number;
  error: string | null;
  selectedFile: File | null;
  uploadComplete: UploadComplete | null;
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleUpload: () => void;
  onUploadComplete?: (audioUrl: string) => void;
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
    if (uploadComplete) {
      onUploadComplete?.(uploadComplete.audioUrl);
    }
  }, [uploadComplete, onUploadComplete]);

  return (
    <div className="space-y-2">
      {/* Not a <form>: this sits inside the episode editor's form. */}
      <div className="space-y-4">
        <Label htmlFor="audioFile">Upload Audio File</Label>
        <Input
          id="audioFile"
          type="file"
          accept=".mp3,.wav,.aac,.m4a"
          onChange={handleFileChange}
          className="w-full"
        />
        <Button type="button" disabled={!selectedFile} onClick={handleUpload}>
          Start Upload
        </Button>
      </div>

      {selectedFile && (
        <p className="text-sm text-gray-600">Selected: {selectedFile.name}</p>
      )}

      {progress > 0 && !uploadComplete && (
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-gray-600">Progress: {progress}%</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {uploadComplete && (
        <div className="space-y-2">
          <p className="text-sm text-green-600">Upload Complete: {uploadComplete.fileName}</p>
        </div>
      )}
    </div>
  );
}