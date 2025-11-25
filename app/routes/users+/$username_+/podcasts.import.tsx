import { FormProvider, getFormProps, getInputProps, useForm } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { data } from '@remix-run/server-runtime'
import fetch from 'node-fetch'
import { Form } from 'react-router'
import { parseStringPromise } from 'xml2js'
import { z } from 'zod'
import { Field, SwitchConform } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { getErrorMessage } from '#app/utils/misc'
import { type Route } from './+types/podcasts.index'
import { ensureUniquePodcastSlug } from '#app/utils/slug.server.ts'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import path from 'node:path'
import fs from 'node:fs/promises'
import { parseBuffer } from 'music-metadata'

const ImportPodcastSchema = z.object({
  rssUrl: z.string().url('Please enter a valid URL'),
  importImages: z.boolean().default(false),
  importEpisodes: z.boolean().default(false),
  importTranscripts: z.boolean().default(false),
})

async function downloadAndConvertToBlob(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    return { buffer, contentType };
  } catch (error) {
    console.error('Error downloading file:', error);
    return null;
  }
}

type StorageConfig =
  | { kind: 's3'; client: S3Client; bucket: string; publicBaseUrl?: string }
  | { kind: 'fs'; baseDir: string; publicBaseUrl?: string }

function createStorageConfig(): StorageConfig {
  if (process.env.USE_S3 === 'true') {
    if (!process.env.S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('S3 storage selected but S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set')
    }
    return {
      kind: 's3',
      bucket: process.env.S3_BUCKET,
      publicBaseUrl: process.env.S3_PUBLIC_URL,
      client: new S3Client({
        region: process.env.S3_REGION || 'us-east-1',
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      }),
    }
  }

  return {
    kind: 'fs',
    baseDir: path.join(process.cwd(), 'uploads', 'audio'),
    publicBaseUrl: '/uploads/audio',
  }
}

async function storeAudioFile({
  podcastId,
  episodeId,
  audioUrl,
  storage,
}: {
  podcastId: string
  episodeId: string
  audioUrl: string
  storage: StorageConfig
}) {
  try {
    const res = await fetch(audioUrl)
    if (!res.ok || !res.body) throw new Error(`Failed to fetch audio: ${res.status} ${res.statusText}`)
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = res.headers.get('content-type') ?? 'audio/mpeg'
    const fileNameFromUrl = (() => {
      try {
        const parsed = new URL(audioUrl)
        const parts = parsed.pathname.split('/').filter(Boolean)
        return parts[parts.length - 1] || 'audio.mp3'
      } catch {
        return 'audio.mp3'
      }
    })()
    const storageKey = `${podcastId}/${fileNameFromUrl}`

    let publicUrl = audioUrl
    if (storage.kind === 's3') {
      await storage.client.send(
        new PutObjectCommand({
          Bucket: storage.bucket,
          Key: storageKey,
          Body: buffer,
          ContentType: contentType,
        }),
      )
      publicUrl = storage.publicBaseUrl
        ? `${storage.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`
        : `s3://${storage.bucket}/${storageKey}`
    } else {
      const target = path.join(storage.baseDir, storageKey)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, buffer)
      publicUrl = storage.publicBaseUrl
        ? `${storage.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`
        : target
    }

    // Try to read duration/format
    let duration = 0
    try {
      const meta = await parseBuffer(buffer, fileNameFromUrl, { duration: true })
      duration = Math.round(meta.format.duration ?? 0)
    } catch (err) {
      console.warn('Failed to parse audio metadata', err)
    }

    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        audioUrl: publicUrl,
        audioSize: buffer.length,
        audioType: contentType,
        duration,
      },
    })
  } catch (err) {
    console.error(`Audio download failed for episode ${episodeId}`, err)
  }
}

export async function action({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request)
  const formData = await request.formData()
  
  const submission = await parseWithZod(formData, {
    schema: ImportPodcastSchema,
  })

  if (submission.status !== 'success') {
    return data(
      { result: submission.reply() },
      { status: submission.status === 'error' ? 400 : 200 },
    )
  }

  const { rssUrl, importImages, importEpisodes, importTranscripts } = submission.value

  try {
    // Fetch the RSS feed
    const response = await fetch(rssUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`)
    }
    const rssText = await response.text()

    const rssData = await parseStringPromise(rssText, { explicitArray: false })
    const channel = rssData.rss.channel

    // Handle podcast cover image
    let podcastImage = undefined;

    if (importImages && channel['itunes:image']?.$?.href) {
      const imageData = await downloadAndConvertToBlob(channel['itunes:image'].$.href);
      if (imageData) {
        podcastImage = {
          create: {
            contentType: imageData.contentType,
            blob: imageData.buffer,
          },
        };
      }
    }

    // Create podcast
    const slug = await ensureUniquePodcastSlug(channel.title || 'podcast')
    const podcast = await prisma.podcast.create({
      data: {
        slug,
        title: channel.title,
        description: channel.description,
        link: channel.link,
        language: channel.language || 'en',
        copyright: channel.copyright || '',
        generator: channel.generator || '',
        lastBuildDate: channel.lastBuildDate
          ? new Date(channel.lastBuildDate)
          : new Date(),
        author: channel['itunes:author'] || '',
        explicit: channel['itunes:explicit'] === 'true',
        type: channel['itunes:type'] || 'episodic',
        category: channel['itunes:category']?.text || 'Uncategorized',
        guid: channel['podcast:guid'] || '',
        locked: channel['podcast:locked'] === 'yes',
        license: channel['podcast:license'] || '',
        baseUrl: channel.link || '',
        ownerId: userId,
        image: podcastImage,
      },
    })

    // Handle episodes if enabled
    if (importEpisodes) {
      const storageConfig = createStorageConfig()
      const episodes = Array.isArray(channel.item) ? channel.item : [channel.item]
      for (const episode of episodes) {
        const enclosureUrl = episode.enclosure?.url ?? episode.enclosure?.$?.url ?? ''
        const enclosureLength = episode.enclosure?.length ?? episode.enclosure?.$?.length ?? '0'
        const enclosureType = episode.enclosure?.type ?? episode.enclosure?.$?.type ?? 'audio/mpeg'

        // Handle episode image if enabled
        let episodeImage = undefined;
        if (importImages && episode['itunes:image']?.$?.href) {
          const imageData = await downloadAndConvertToBlob(episode['itunes:image']?.$?.href);
          if (imageData) {
            episodeImage = {
              create: {
                contentType: imageData.contentType,
                blob: imageData.buffer,
              },
            };
          }
        }

        // Handle transcript if enabled
        let transcriptBlob = undefined;

        if (importTranscripts && episode['podcast:transcript']?.$?.url) {
          const transcriptData = await downloadAndConvertToBlob(episode['podcast:transcript']?.$?.url);

          console.log("transcript data", transcriptData, transcriptData.contentType)
          if (transcriptData) {
            transcriptBlob = {
              create: {
                contentType: transcriptData.contentType,
                blob: transcriptData.buffer,
              },
            };
          }
        }

        const createdEpisode = await prisma.episode.create({
          data: {
            title: episode.title,
            description: episode.description,
            link: episode.link,
            audioUrl: enclosureUrl || '',
            audioSize: parseInt(enclosureLength, 10),
            audioType: enclosureType,
            guid: episode.guid?._ || episode.guid || '',
            pubDate: episode.pubDate ? new Date(episode.pubDate) : new Date(),
            duration: parseInt(episode['itunes:duration'] || '0', 10),
            episodeType: episode['itunes:episodeType'] || 'full',
            episode: parseInt(episode['itunes:episode'] || '0', 10),
            explicit: episode['itunes:explicit'] === 'true',
            podcastId: podcast.id,
            image: episodeImage,
            transcript: transcriptBlob,
          },
        })

        // Kick off audio download/storage in the background so the response isn't blocked
        if (enclosureUrl) {
          void storeAudioFile({
            podcastId: podcast.id,
            episodeId: createdEpisode.id,
            audioUrl: enclosureUrl,
            storage: storageConfig,
          })
        }
      }
    }

    return data({ success: true, podcastId: podcast.id })
  } catch (error) {
    console.error('Error importing RSS feed:', error)
    return data({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function loader() {
  return data({})
}

export default function ImportPodcast({ actionData }: { actionData?: any }) {
  const [form, fields] = useForm({
    id: 'import-podcast-form',
    constraint: getZodConstraint(ImportPodcastSchema),
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: ImportPodcastSchema })
    },
    defaultValue: {
      importImages: true,
      importEpisodes: true,
      importTranscripts: true,
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <div className="mx-auto p-6 w-full">
      <h1 className="mb-8 text-3xl font-bold">Import Podcast from RSS</h1>
      <FormProvider context={form.context}>
        <Form method="post" className="space-y-6" {...getFormProps(form)}>
          <Field
            labelProps={{ children: 'RSS Feed URL' }}
            inputProps={{
              ...getInputProps(fields.rssUrl, { type: 'url' }),
              placeholder: 'https://example.com/feed.xml',
            }}
            errors={fields.rssUrl.errors}
          />

          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <SwitchConform meta={fields.importImages} />
              <Label htmlFor="importImages">Import Images</Label>
            </div>

            <div className="flex items-center space-x-2">
              <SwitchConform meta={fields.importEpisodes} />
              <Label htmlFor="importEpisodes">Import Episodes</Label>
            </div>

            <div className="flex items-center space-x-2">
              <SwitchConform meta={fields.importTranscripts} />
              <Label htmlFor="importTranscripts">Import Transcripts</Label>
            </div>
          </div>

          <hr />

          <Button type="submit">Import Podcast</Button>
        </Form>
      </FormProvider>
    </div>
  )
}
