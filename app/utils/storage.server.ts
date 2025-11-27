import { createHash, createHmac } from 'crypto'
import { type FileUpload } from '@mjackson/form-data-parser'
import { createId } from '@paralleldrive/cuid2'
import {
	CreateBucketCommand,
	HeadBucketCommand,
	S3Client,
} from '@aws-sdk/client-s3'

const STORAGE_ENDPOINT = process.env.AWS_ENDPOINT_URL_S3
const STORAGE_BUCKET = process.env.BUCKET_NAME
const STORAGE_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const STORAGE_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY
const STORAGE_REGION = process.env.AWS_REGION

const s3Client =
	STORAGE_ENDPOINT && STORAGE_REGION && STORAGE_ACCESS_KEY && STORAGE_SECRET_KEY
		? new S3Client({
				region: STORAGE_REGION,
				endpoint: STORAGE_ENDPOINT,
				credentials: {
					accessKeyId: STORAGE_ACCESS_KEY,
					secretAccessKey: STORAGE_SECRET_KEY,
				},
				forcePathStyle: true,
			})
		: null
let bucketEnsured = false

function requireStorageEnv() {
	if (
		!STORAGE_ENDPOINT ||
		!STORAGE_BUCKET ||
		!STORAGE_ACCESS_KEY ||
		!STORAGE_SECRET_KEY ||
		!STORAGE_REGION
	) {
		throw new Error('S3 storage environment variables are not fully configured')
	}
}

async function uploadToStorage(file: File | FileUpload, key: string) {
	requireStorageEnv()
	await ensureBucket()
	const { url, headers } = getSignedPutRequestInfo(file, key)

	const uploadResponse = await fetch(url, {
		method: 'PUT',
		headers,
		body: file instanceof File ? file : file.stream(),
	})

	if (!uploadResponse.ok) {
		const errorMessage = `Failed to upload file to storage. Server responded with ${uploadResponse.status}: ${uploadResponse.statusText}`
		console.error(errorMessage)
		throw new Error(`Failed to upload object: ${key}`)
	}

	return key
}

async function ensureBucket() {
	if (!s3Client || bucketEnsured) return
	try {
		await s3Client.send(new HeadBucketCommand({ Bucket: STORAGE_BUCKET }))
		bucketEnsured = true
		return
	} catch (error) {
		// ignore and try create
	}
	try {
		await s3Client.send(
			new CreateBucketCommand({ Bucket: STORAGE_BUCKET, ACL: 'private' }),
		)
		bucketEnsured = true
	} catch (error) {
		console.error('Failed to ensure bucket exists', error)
		throw error
	}
}

function buildImageKey(pathParts: Array<string>) {
	const fileId = createId()
	const timestamp = Date.now()
	const [fileName] = pathParts.splice(pathParts.length - 1, 1)
	const extension = fileName.split('.').pop() || ''
	const safeBase = fileName.replace(/\.[^/.]+$/, '')
	return [...pathParts, `${timestamp}-${safeBase}-${fileId}.${extension}`]
		.map((p) => p.replace(/^\/+|\/+$/g, ''))
		.join('/')
}

export async function uploadProfileImage(
	userId: string,
	file: File | FileUpload,
) {
	const key = buildImageKey(['users', userId, 'profile-images', file.name])
	return uploadToStorage(file, key)
}

export async function uploadPodcastImage(
	userId: string,
	podcastId: string,
	file: File | FileUpload,
) {
	const key = buildImageKey(['users', userId, 'podcasts', podcastId, file.name])
	return uploadToStorage(file, key)
}

export async function uploadEpisodeImage(
	userId: string,
	podcastId: string,
	episodeId: string,
	file: File | FileUpload,
) {
	const key = buildImageKey([
		'users',
		userId,
		'podcasts',
		podcastId,
		'episodes',
		episodeId,
		file.name,
	])
	return uploadToStorage(file, key)
}

function hmacSha256(key: string | Buffer, message: string) {
	const hmac = createHmac('sha256', key)
	hmac.update(message)
	return hmac.digest()
}

function sha256(message: string) {
	const hash = createHash('sha256')
	hash.update(message)
	return hash.digest('hex')
}

function getSignatureKey(
	key: string,
	dateStamp: string,
	regionName: string,
	serviceName: string,
) {
	const kDate = hmacSha256(`AWS4${key}`, dateStamp)
	const kRegion = hmacSha256(kDate, regionName)
	const kService = hmacSha256(kRegion, serviceName)
	const kSigning = hmacSha256(kService, 'aws4_request')
	return kSigning
}

function getBaseSignedRequestInfo({
	method,
	key,
	contentType,
	uploadDate,
}: {
	method: 'GET' | 'PUT'
	key: string
	contentType?: string
	uploadDate?: string
}) {
	requireStorageEnv()
	const url = `${STORAGE_ENDPOINT}/${STORAGE_BUCKET}/${key}`
	const endpoint = new URL(url)

	// Prepare date strings
	const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
	const dateStamp = amzDate.slice(0, 8)

	// Build headers array conditionally
	const headers = [
		...(contentType ? [`content-type:${contentType}`] : []),
		`host:${endpoint.host}`,
		`x-amz-content-sha256:UNSIGNED-PAYLOAD`,
		`x-amz-date:${amzDate}`,
		...(uploadDate ? [`x-amz-meta-upload-date:${uploadDate}`] : []),
	]

	const canonicalHeaders = headers.join('\n') + '\n'
	const signedHeaders = headers.map((h) => h.split(':')[0]).join(';')

	const canonicalRequest = [
		method,
		`/${STORAGE_BUCKET}/${key}`,
		'', // canonicalQueryString
		canonicalHeaders,
		signedHeaders,
		'UNSIGNED-PAYLOAD',
	].join('\n')

	// Prepare string to sign
	const algorithm = 'AWS4-HMAC-SHA256'
	const credentialScope = `${dateStamp}/${STORAGE_REGION}/s3/aws4_request`
	const stringToSign = [
		algorithm,
		amzDate,
		credentialScope,
		sha256(canonicalRequest),
	].join('\n')

	// Calculate signature
	const signingKey = getSignatureKey(
		STORAGE_SECRET_KEY,
		dateStamp,
		STORAGE_REGION,
		's3',
	)
	const signature = createHmac('sha256', signingKey)
		.update(stringToSign)
		.digest('hex')

	const baseHeaders = {
		'X-Amz-Date': amzDate,
		'X-Amz-Content-SHA256': 'UNSIGNED-PAYLOAD',
		Authorization: [
			`${algorithm} Credential=${STORAGE_ACCESS_KEY}/${credentialScope}`,
			`SignedHeaders=${signedHeaders}`,
			`Signature=${signature}`,
		].join(', '),
	}

	return { url, baseHeaders }
}

function getSignedPutRequestInfo(file: File | FileUpload, key: string) {
	const uploadDate = new Date().toISOString()
	const { url, baseHeaders } = getBaseSignedRequestInfo({
		method: 'PUT',
		key,
		contentType: file.type,
		uploadDate,
	})

	return {
		url,
		headers: {
			...baseHeaders,
			'Content-Type': file.type,
			'X-Amz-Meta-Upload-Date': uploadDate,
		},
	}
}

export function getSignedGetRequestInfo(key: string) {
	const { url, baseHeaders } = getBaseSignedRequestInfo({
		method: 'GET',
		key,
	})

	return {
		url,
		headers: baseHeaders,
	}
}
