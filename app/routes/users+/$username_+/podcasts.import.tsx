import {
	FormProvider,
	getFormProps,
	getInputProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { data } from '@remix-run/server-runtime'
import React, { useState } from 'react'
import { Form, useFetcher } from 'react-router'
import { Field, SwitchConform } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { ImportPodcastSchema } from '#app/schemas/import-podcast.ts'
import { type Route } from './+types/podcasts.index'

export { action, loader } from './podcasts.import.server'

export default function ImportPodcast({ actionData }: { actionData?: any }) {
  const fetcher = useFetcher<{ status: string; error?: string | null; result?: { podcastId?: string } }>()
  const [jobId, setJobId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Poll job status when queued
  React.useEffect(() => {
    if (!jobId) return
    const interval = setInterval(() => {
      fetcher.load(`/resources/job-status/${jobId}`)
    }, 2000)
    return () => clearInterval(interval)
  }, [jobId, fetcher])

  React.useEffect(() => {
    if (!actionData?.jobId) return
    setJobId(actionData.jobId)
    setStatusMessage('Import queued...')
  }, [actionData?.jobId])

  React.useEffect(() => {
    if (fetcher.data?.status === 'succeeded') {
      const podcastId = fetcher.data?.result?.podcastId
      setStatusMessage(
        podcastId
          ? `Import complete. Podcast ID: ${podcastId}`
          : 'Import complete.',
      )
      if (podcastId) {
        window.location.href = `/users/${actionData?.username ?? 'me'}/podcasts/${podcastId}`
      }
      setJobId(null)
    } else if (fetcher.data?.status === 'failed') {
      setStatusMessage(`Import failed: ${fetcher.data.error || 'Unknown error'}`)
      setJobId(null)
    }
  }, [fetcher.data])

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
      {statusMessage ? (
        <div className="mb-4 rounded-md border border-muted-foreground/20 bg-muted/40 p-3 text-sm">
          {statusMessage}
        </div>
      ) : null}
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
