// #app/components/EpisodeEditor.tsx
import {
	FormProvider,
	getFormProps,
	getInputProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { format } from 'date-fns/format'
import { CalendarIcon, Trash2  } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Form, Link, useFetcher, useParams } from 'react-router'
import { z } from 'zod'
import DeleteDialogWithInput from '#app/components/delete-dialog-with-input.tsx'
import {
	Field,
	MinimalEditorField,
	NumberField,
} from '#app/components/forms.tsx'
import { Button, Button as UIButton  } from '#app/components/ui/button'
import { Calendar } from '#app/components/ui/calendar'
import { Input } from '#app/components/ui/input'
import { Label } from '#app/components/ui/label'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '#app/components/ui/popover'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '#app/components/ui/select.tsx'
import { Switch } from '#app/components/ui/switch'
import { Textarea } from '#app/components/ui/textarea'
import Uploader from '#app/components/uploader.tsx'
import { useChunkUploader } from '#app/hooks/use-chunk-uploader.ts'
import { getEpisodeImgSrc } from '#app/utils/misc.tsx'
import { type Info } from './+types/podcasts.$podcastId.episode.$episodeId.new'

export const EpisodeEditorSchema = z.object({
	title: z.string().min(1, 'Title is required.').max(100),
	description: z.string().min(1, 'Description is required.').max(4000),
	pubDate: z.string().min(1, 'Publish date is required.'),
	season: z.number().optional(),
	episode: z.number().optional(),
	explicit: z.boolean().default(false),
	isPublished: z.coerce.boolean().default(false),
	publishMode: z.enum(['draft', 'schedule']).default('draft'),
	episodeType: z.enum(['full', 'trailer', 'bonus']),
	audioFile: z.string().optional(), // Added for uploaded file
	image: z
		.object({
			id: z.string().optional(),
			file: z
				.instanceof(File, {
					message: 'A valid image file is required if provided',
				})
				.optional()
				.refine(
					(file) => !file || ['image/jpeg', 'image/png'].includes(file.type),
					'File must be a JPEG or PNG image',
				)
				.refine(
					(file) => !file || file.size <= 5 * 1024 * 1024,
					'File size must be less than 5MB',
				),
		})
		.optional(),
})

function formatDuration(durationSeconds?: number | null) {
	if (!durationSeconds || durationSeconds <= 0) return '—'
	const hrs = Math.floor(durationSeconds / 3600)
	const mins = Math.floor((durationSeconds % 3600) / 60)
	const secs = Math.floor(durationSeconds % 60)
	const parts = [hrs, mins, secs].map((n) => n.toString().padStart(2, '0'))
	return parts.join(':')
}

export default function EpisodeEditor({
	episode,
	actionData,
}: {
	episode?: Info['loaderData']['episode']
	actionData?: Info['actionData']
}) {
	const initialDate = useMemo(
		() => (episode?.pubDate ? new Date(episode.pubDate) : new Date()),
		[episode?.pubDate],
	)

	const [selectedDate, setSelectedDate] = useState(initialDate)
	const [episodeNum, setEpisode] = useState<number | null>(null)
	const [seasonNum, setSeasonNum] = useState<number | null>(null)
	const initialIsPublished = episode?.isPublished ?? false
	const initialPublishMode = useMemo(() => {
		if (initialIsPublished) return 'draft'
		if (episode?.pubDate && new Date(episode.pubDate) > new Date()) return 'schedule'
		return 'draft'
	}, [episode?.pubDate, initialIsPublished])
	const [publishMode, setPublishMode] = useState<'draft' | 'schedule'>(initialPublishMode)
	const [isPublished, setIsPublished] = useState(initialIsPublished)
	const [uploadedFile, setUploadedFile] = useState<string | null>(null)
	const [imagePreview, setImagePreview] = useState<string | null>(
		episode?.image ? getEpisodeImgSrc(episode.image) : null,
	)
	const hasExistingAudio = Boolean(episode?.audioUrl)
	const [isReplacingAudio, setIsReplacingAudio] = useState(false)
	const existingAudioSize =
		episode?.audioSize != null
			? `${(episode.audioSize / 1024 / 1024).toFixed(1)} MB`
			: null
	const existingAudioDuration = formatDuration(episode?.duration)

	const formattedDate = useMemo(
		() => format(selectedDate, 'dd-MM-yyyy HH:mm:ss'),
		[selectedDate],
	)
	const isoDate = useMemo(() => selectedDate.toISOString(), [selectedDate])

	const [selectedType, setSelectedType] = useState(episode?.type || 'full')

	const defaultValues = useMemo(
		() => ({
			id: 'podcast-episode-editor',
			title: episode?.title || '',
			description: episode?.description || '',
			pubDate: episode?.pubDate
				? format(new Date(episode.pubDate), 'MM-dd-yyyy HH:mm:ss')
				: format(new Date(), 'MM-dd-yyyy HH:mm:ss'),
			explicit: episode?.explicit || false,
			season: episode?.season,
			episode: episode?.episode,
			isPublished: initialIsPublished,
			publishMode: initialPublishMode,
			episodeType: episode?.type || 'full',
			image: episode?.image,
		}),
		[episode, initialPublishMode, initialIsPublished],
	)

	const [form, fields] = useForm({
		id: 'episode-editor',
		constraint: getZodConstraint(EpisodeEditorSchema),
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: EpisodeEditorSchema })
		},
		lastResult: actionData?.result,
		defaultValue: defaultValues,
		shouldRevalidate: 'onBlur',
	})

	const handleDateSelect = useCallback((date: Date | undefined) => {
		if (date) setSelectedDate(date)
	}, [])

	// Use the uploader hook
	const params = useParams()
	const uploaderProps = useChunkUploader({
		username: params.username!,
		podcastId: params.podcastId!,
		episodeId: params.episodeId!
	})

	const transcriptFetcher = useFetcher<{ transcript?: string }>()
	const [transcriptDraft, setTranscriptDraft] = useState('')

	useEffect(() => {
		if (episode?.id) {
			transcriptFetcher.load(`/resources/episode-transcript/${episode.id}`)
		}
	}, [episode?.id])

	useEffect(() => {
		if (transcriptFetcher.data?.transcript !== undefined) {
			setTranscriptDraft(transcriptFetcher.data.transcript)
		}
	}, [transcriptFetcher.data])

	return (
		<main className="p-6 pb-24 max-w-4xl mx-auto">
			<h1 className="mb-4 text-2xl font-bold">
				{episode ? 'Edit' : 'Create'} Episode
			</h1>
			<FormProvider context={form.context}>
				<Form
					method="POST"
					encType="multipart/form-data"
					{...getFormProps(form)}
					className="space-y-6"
				>
					{episode ? (
						<input type="hidden" name="id" value={episode?.id} />
					) : null}

					{/* Uploader Section */}
					<div className="space-y-4">
						<Label>Episode Image</Label>
						<div className="flex items-center gap-4">
							<div className="h-20 w-20 overflow-hidden rounded-md border bg-muted">
								{imagePreview ? (
									<img
										src={imagePreview}
										alt="Episode image"
										className="h-full w-full object-cover"
									/>
								) : (
									<div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
										No image
									</div>
								)}
							</div>
							<input
								type="file"
								name="image.file"
								accept="image/*"
								onChange={(event) => {
									const file = event.target.files?.[0]
									if (file) {
										const reader = new FileReader()
										reader.onloadend = () =>
											setImagePreview(reader.result as string)
										reader.readAsDataURL(file)
									} else {
										setImagePreview(null)
									}
								}}
							/>
							{episode?.image?.id ? (
								<input
									type="hidden"
									name="image.id"
									defaultValue={episode.image.id}
								/>
							) : null}
						</div>
					</div>

					<div className="space-y-4">
						{hasExistingAudio ? (
							<div className="rounded-md border p-4 shadow-sm">
								{!isReplacingAudio && (
									<>
										<div className="flex items-center justify-between gap-3">
											<div className="text-sm font-semibold text-foreground">
												Current audio
											</div>
											{episode?.audioType ? (
												<span className="text-xs text-muted-foreground">
													{episode.audioType}
												</span>
											) : null}
										</div>
										{episode?.audioUrl ? (
											<audio
												controls
												src={episode.audioUrl}
												className="mt-2 w-full"
												preload="metadata"
											/>
										) : null}
										<div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
											{existingAudioSize ? <span>{existingAudioSize}</span> : null}
											{existingAudioDuration !== '—' ? (
												<span>{existingAudioDuration}</span>
											) : null}
										</div>
										<div className="mt-3">
											<Button
												type="button"
												variant="secondary"
												onClick={() => setIsReplacingAudio(true)}
											>
												Replace audio file
											</Button>
										</div>
									</>
								)}
								{isReplacingAudio && (
									<div className="space-y-3">
										<div className="text-sm font-semibold text-foreground">
											Replace audio file
										</div>
										<div className="space-y-2">
											<Uploader
												{...uploaderProps}
												onUploadComplete={(file) => setUploadedFile(file)}
											/>
											{uploadedFile && (
												<p className="text-sm text-muted-foreground">
													Audio file uploaded: {uploadedFile}
												</p>
											)}
											<div className="flex items-center gap-2">
												<Button
													type="button"
													variant="ghost"
													onClick={() => {
														setIsReplacingAudio(false)
														setUploadedFile(null)
													}}
												>
													Cancel
												</Button>
											</div>
										</div>
									</div>
								)}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								No audio uploaded yet. Upload a file to attach audio to this episode.
							</p>
						)}
						{!hasExistingAudio && (
							<div className="space-y-2">
								<div className="text-sm font-medium">Upload audio file</div>
								<Uploader
									{...uploaderProps}
									onUploadComplete={(file) => setUploadedFile(file)}
								/>
								{uploadedFile && (
									<p className="text-sm text-gray-600">
										Audio file uploaded: {uploadedFile}
									</p>
								)}
							</div>
						)}
					</div>

					<hr />

					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<Label className="text-base font-semibold">Transcript</Label>
							{transcriptDraft && (
								<UIButton
									type="button"
									variant="ghost"
									size="icon"
									title="Delete transcript"
									onClick={() => {
										if (!episode?.id) return
										transcriptFetcher.submit(
											{},
											{
												method: 'delete',
												action: `/resources/episode-transcript/${episode.id}`,
											},
										)
										setTranscriptDraft('')
									}}
								>
									<Trash2 className="h-4 w-4" />
								</UIButton>
							)}
						</div>
						<Textarea
							rows={10}
							value={transcriptDraft}
							onChange={(e) => setTranscriptDraft(e.target.value)}
							placeholder="Add or edit transcript..."
						/>
						<div className="flex justify-end gap-2">
							<UIButton
								type="button"
								variant="outline"
								onClick={() => setTranscriptDraft('')}
							>
								Clear
							</UIButton>
							<UIButton
								type="button"
								onClick={() => {
									if (!episode?.id) return
									const formData = new FormData()
									formData.set('transcript', transcriptDraft)
									transcriptFetcher.submit(formData, {
										method: 'post',
										action: `/resources/episode-transcript/${episode.id}`,
									})
								}}
							>
								Save transcript
							</UIButton>
						</div>
					</div>

					<Field
						labelProps={{ children: 'Title' }}
						inputProps={{
							...getInputProps(fields.title, { type: 'text' }),
							placeholder: 'Episode title',
						}}
						errors={fields.title.errors}
					/>

					<MinimalEditorField
						labelProps={{ children: 'Description', htmlFor: 'description' }}
						initialHTML={episode?.description}
						onChange={() => {}}
						errors={fields?.description?.errors}
					/>

					<input type="hidden" name="audioFile" value={uploadedFile || ''} />

					<hr />

					<div className="flex flex-row gap-x-8">
						<NumberField
							min={1}
							max={10000}
							labelProps={{ children: 'Episode' }}
							onChange={setEpisode}
							value={episodeNum}
							errors={fields.episode.errors}
						/>
						<NumberField
							min={1}
							max={10000}
							labelProps={{ children: 'Season' }}
							onChange={setSeasonNum}
							value={seasonNum}
							errors={fields.season.errors}
						/>
					</div>

					<div>
						<Label htmlFor="type">Type</Label>
						<Select value={selectedType} onValueChange={setSelectedType}>
							<SelectTrigger id="type">
								<SelectValue placeholder="Select a Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="full">Full</SelectItem>
								<SelectItem value="trailer">Trailer</SelectItem>
								<SelectItem value="bonus">Bonus</SelectItem>
							</SelectContent>
						</Select>
						<input type="hidden" name="episodeType" value={selectedType} />
					</div>

					<div className="space-y-1">
						<Label htmlFor="pubDate">Publish Date</Label>
						<Popover>
							<PopoverTrigger asChild>
								<div className="relative">
									<Input
										id="pubDate"
										readOnly
										placeholder="Pick a date"
										value={formattedDate}
										className="cursor-pointer text-left"
									/>
									<CalendarIcon className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
								</div>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="single"
									selected={selectedDate}
									onSelect={handleDateSelect}
									initialFocus
								/>
							</PopoverContent>
						</Popover>
						<input type="hidden" name="pubDate" value={isoDate} />
					</div>

					<div className="space-y-3 py-2">
						<div className="flex items-center gap-3">
							<Label htmlFor="explicit">Explicit</Label>
							<Switch
								id="explicit"
								defaultChecked={episode?.explicit ?? false}
								{...getInputProps(fields.explicit, { type: 'checkbox' })}
								onChange={(e) => fields.explicit.onChange(e.target.checked)}
							/>
						</div>
						<div className="flex items-center gap-3">
							<Label htmlFor="is-published">Publish now</Label>
							<Switch
								id="is-published"
								checked={isPublished}
								onCheckedChange={(checked) => setIsPublished(checked)}
							/>
							<input type="hidden" name="isPublished" value={String(isPublished)} />
						</div>
						{!isPublished ? (
							<div className="space-y-2">
								<Label>Publish later</Label>
								<Select
									value={publishMode}
									onValueChange={(value) =>
										setPublishMode(value as 'draft' | 'schedule')
									}
								>
									<SelectTrigger className="w-full md:w-64">
										<SelectValue placeholder="Select publish mode" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="draft">Save as draft</SelectItem>
										<SelectItem value="schedule">Schedule for selected date</SelectItem>
									</SelectContent>
								</Select>
								<input type="hidden" name="publishMode" value={publishMode} />
								<p className="text-xs text-muted-foreground">
									Use “Schedule” to auto-publish at the chosen date and time.
								</p>
							</div>
						) : (
							<input type="hidden" name="publishMode" value="draft" />
						)}
					</div>

					<hr />

					<div className="flex gap-4 pb-10">
						<Button type="submit">Save</Button>
						<Link to={`../`}>
							<Button variant="outline">Cancel</Button>
						</Link>

						<span className="ml-auto">
							<DeleteDialogWithInput
								displayTriggerButton={episode != null}
								verificationString={episode?.title}
								placeholder="Enter podcast title"
							/>
						</span>
					</div>
				</Form>
			</FormProvider>
		</main>
	)
}
