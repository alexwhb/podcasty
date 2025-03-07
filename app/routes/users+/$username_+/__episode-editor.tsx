// #app/components/EpisodeEditor.tsx
import {
	FormProvider,
	getFormProps,
	getInputProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { format } from 'date-fns/format'
import { CalendarIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Form, Link } from 'react-router'
import { z } from 'zod'
import DeleteDialogWithInput from '#app/components/delete-dialog-with-input.tsx'
import DeleteDialog from '#app/components/delete-dialog.tsx'
import {
	Field,
	MinimalEditorField,
	NumberField,
} from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button'
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
import Uploader from '#app/components/uploader.tsx'
import { useChunkUploader } from '#app/hooks/use-chunk-uploader.ts'
import { type Info } from './+types/podcasts.$podcastId.episode.$episodeId.new'

export const EpisodeEditorSchema = z.object({
	title: z.string().min(1, 'Title is required.').max(100),
	description: z.string().min(1, 'Description is required.').max(4000),
	pubDate: z.string().min(1, 'Publish date is required.'),
	season: z.number().optional(),
	episode: z.number().optional(),
	explicit: z.boolean().default(false),
	isPublished: z.boolean().default(false),
	episodeType: z.enum(['full', 'trailer', 'bonus']),
	audioFile: z.string().optional(), // Added for uploaded file
})

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
	const [uploadedFile, setUploadedFile] = useState<string | null>(null)

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
			isPublished: episode?.isPublished || false,
			episodeType: episode?.type || 'full',
			audioFile: episode?.audioFile || '', // Assuming episode might have an audioFile field
		}),
		[episode],
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
	const uploaderProps = useChunkUploader()

	return (
		<main className="flex-1 overflow-y-auto p-6">
			<h1 className="mb-4 text-2xl font-bold">Edit Episode</h1>
			<FormProvider context={form.context}>
				<Form method="POST" {...getFormProps(form)} className="space-y-6">
					{episode ? (
						<input type="hidden" name="id" value={episode?.id} />
					) : null}

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

					<hr />

					{/* Uploader Section */}
					<div className="space-y-4">
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

					<div className="flex items-center space-x-2 py-2">
						<Label htmlFor="explicit">Explicit</Label>
						<Switch
							id="explicit"
							defaultChecked={episode?.explicit ?? false}
							{...getInputProps(fields.explicit, { type: 'checkbox' })}
							onChange={(e) => fields.explicit.onChange(e.target.checked)}
						/>
						<span className="px-4"></span>
						<Label htmlFor="is-published">Is Published</Label>
						<Switch
							id="is-published"
							defaultChecked={episode?.isPublished ?? false}
							{...getInputProps(fields.isPublished, { type: 'checkbox' })}
							onChange={(e) => fields.isPublished.onChange(e.target.checked)}
						/>
					</div>

					<hr />

					<div className="flex gap-4">
						<Button type="submit">Save</Button>
						<Link to={`../`}>
							<Button variant="outline">Cancel</Button>
						</Link>

						<span className="ml-auto">
							<DeleteDialog
								displayTriggerButton={episode != null}
							/>
						</span>
					</div>
				</Form>
			</FormProvider>
		</main>
	)
}
