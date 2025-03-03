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
    const podcast = await prisma.podcast.create({
      data: {
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
      const episodes = Array.isArray(channel.item) ? channel.item : [channel.item]
      for (const episode of episodes) {
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

        await prisma.episode.create({
          data: {
            title: episode.title,
            description: episode.description,
            link: episode.link,
            audioUrl: episode.enclosure?.url || '',
            audioSize: parseInt(episode.enclosure?.length || '0', 10),
            audioType: episode.enclosure?.type || 'audio/mpeg',
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
      const test =  parseWithZod(formData, { schema: ImportPodcastSchema })
      console.log(test)
      return test
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