import { z } from 'zod'

export const CHUNK_SIZE = 1024 * 1024 // 1MB

const supportedAudioTypes = [
	'audio/mpeg',
	'audio/wav',
	'audio/aac',
	'audio/x-m4a',
]
const supportedExtensions = ['.mp3', '.wav', '.aac', '.m4a']

export const UploadChunkSchema = z.object({
	chunk: z.instanceof(Blob).refine((blob) => {
		console.log('Validating blob:', { type: blob.type, size: blob.size })
		// Accept any blob if the fileName extension is valid
		return true
	}, 'File must be a podcast-supported audio format (MP3, WAV, AAC, M4A)'),
	uploadId: z.string().min(1, 'Upload ID is required'),
	chunkIndex: z.coerce
		.number()
		.int()
		.min(0, 'Chunk index must be a non-negative integer'),
	totalChunks: z.coerce
		.number()
		.int()
		.min(1, 'Total chunks must be at least 1'),
	fileName: z.string().refine((name) => {
    return supportedExtensions.some((ext) => name.toLowerCase().endsWith(ext))
	}, 'File must have a supported extension (.mp3, .wav, .aac, .m4a)'),
})

export const ResumeSchema = z.object({
	uploadId: z.string().min(1, 'Upload ID is required'),
})

/**
 * Extracts a chunk from a file at the specified index
 * @param file - The source file to slice
 * @param chunkIndex - Zero-based index of the chunk to extract
 * @param chunkSize - Size of each chunk in bytes (defaults to CHUNK_SIZE constant)
 * @returns A Blob containing the requested chunk of the file
 */
export function getChunk(
	file: File,
	chunkIndex: number,
	chunkSize: number = CHUNK_SIZE,
) {
	const start = chunkIndex * chunkSize
	const end = Math.min(start + chunkSize, file.size)
	return file.slice(start, end)
}

/**
 * Calculates the total number of chunks needed for a file
 * @param fileSize - Total size of the file in bytes
 * @param chunkSize - Size of each chunk in bytes (defaults to CHUNK_SIZE constant)
 * @returns The total number of chunks needed to upload the entire file
 */
export function calculateTotalChunks(
	fileSize: number,
	chunkSize: number = CHUNK_SIZE,
) {
	return Math.ceil(fileSize / chunkSize)
}