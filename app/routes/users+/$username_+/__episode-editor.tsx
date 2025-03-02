import {
	FormProvider,
	getFormProps,
	getInputProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { format } from 'date-fns/format'
import { CalendarIcon } from 'lucide-react'
import { useState, useMemo, useCallback } from 'react'
import { Form, Link } from 'react-router'
import { z } from 'zod'
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
	PopoverTrigger,
	PopoverContent,
} from '#app/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#app/components/ui/select.tsx'
import { Switch } from '#app/components/ui/switch'
// @ts-ignore
import {type Info} from './+types/podcasts.$podcastId.episode.$episodeId.new'


export const EpisodeEditorSchema = z.object({
	title: z.string().min(1, 'Title is required.').max(100),
	description: z.string().min(1, 'Description is required.').max(4000),
	pubDate: z.string().min(1, 'Publish date is required.'),
	season: z.number().optional(),
	episode: z.number().optional(),
	explicit: z.boolean().default(false),
	isPublished: z.boolean().default(false),
})

export default function EpisodeEditor({ episode, actionData }: {
	episode?: Info['loaderData']['episode']
	actionData?: Info['actionData']
}) {
	// Memoize the initial date to avoid recalculation on re-renders
	const initialDate = useMemo(
		() => (episode?.pubDate ? new Date(episode.pubDate) : new Date()),
		[episode?.pubDate],
	)

	const [selectedDate, setSelectedDate] = useState(initialDate)
	const [episodeNum, setEpisode] = useState<number | null>(null)
	const [seasonNum, setSeasonNum] = useState<number | null>(null)
	// Memoize the formatted date
	const formattedDate = useMemo(
		() => format(selectedDate, 'dd-MM-yyyy HH:mm:ss'),
		[selectedDate],
	)

	// Add a new memo for the ISO format
	const isoDate = useMemo(
		() => selectedDate.toISOString(),
		[selectedDate],
	)

	const [selectedType, setSelectedType] = useState(episode?.type || 'full')

	// Memoize default values to prevent unnecessary recalculations
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
		}),
		[episode],
	)

	const [form, fields] = useForm({
		id: 'episode-editor',
		constraint: getZodConstraint(EpisodeEditorSchema),
		onValidate({ formData }) {
			const res =  parseWithZod(formData, { schema: EpisodeEditorSchema })
			console.log(res)
			return res
		},
		lastResult: actionData?.result,
		defaultValue: defaultValues,
		shouldRevalidate: 'onBlur',
	})

	// Memoize the date selection handler
	const handleDateSelect = useCallback((date: Date | undefined) => {
		if (date) {
			setSelectedDate(date)
		}
	}, [])

	return (
		<main className="flex-1 overflow-y-auto p-6">
			<h1 className="mb-4 text-2xl font-bold">Edit Episode</h1>
			<FormProvider context={form.context}>
				<Form method="POST" {...getFormProps(form)} className="space-y-6">
					{/* Title Field */}
					{episode ? (
						<input type="hidden" name="id" value={episode?.id}/>
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
						labelProps={{ children: "Description", htmlFor: "description" }}
						initialHTML={episode?.description}
						onChange={(html) => {

						}}
						errors={fields?.description?.errors}
					/>

					<div className="flex flex-row gap-x-8">
						<NumberField
							min={1}
							max={10000}
							labelProps={{ children: 'Episode' }}
							onChange={(number: number | null) => setEpisode(number)}
							value={episodeNum}
							errors={fields.episode.errors}
						/>

						<NumberField
							min={1}
							max={10000}
							labelProps={{ children: 'Season' }}
							onChange={(number: number | null) => setSeasonNum(number)}
							value={seasonNum}
							errors={fields.season.errors}
						/>
					</div>


					{/* Podcast Type */}
					<div>
						<Label htmlFor="type">Type</Label>
						<Select
							value={selectedType}
							onValueChange={(value: string) => {
								setSelectedType(value)
							}}
						>
							<SelectTrigger id="type">
								<SelectValue placeholder="Select a Type"/>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={'full'}>
									Full
								</SelectItem>
								<SelectItem value={'trailer'}>
									Trailer
								</SelectItem>
								<SelectItem value={'bonus'}>
									Bonus
								</SelectItem>
							</SelectContent>
						</Select>
						{/* Hidden input to submit language */}
						<input
							type="hidden"
							name="type"
							value={selectedType} // Serialize the editor's content to HTML
						/>
					</div>

					{/* Publish Date Field using Calendar with Popover */}
					<div className="space-y-1">
						<Label htmlFor="pubDate">Publish Date</Label>
						<Popover>
							<PopoverTrigger asChild>
								<div className="relative">
									<Input
										id="pubDate"
										readOnly
										placeholder="Pick a date"
										value={formattedDate} // Display the formatted date
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
						<input type="hidden" name="pubDate" value={isoDate} /> {/* Send ISO format to backend */}
					</div>


					{/* Switches for Explicit and Is Published */}
					<div className="flex items-center space-x-2 py-2">
						<Label htmlFor="explicit">Explicit</Label>
						<Switch
							id="explicit"
							defaultChecked={episode?.explicit ?? false}
							{...getInputProps(fields.explicit, {type: "checkbox"})}
							onChange={(e) => {
								fields.explicit.onChange(e.target.checked);
							}}
						/>
						<span className="px-4"></span>
						<Label htmlFor="explicit">Is Published</Label>
						<Switch
							id="is-published"
							defaultChecked={episode?.isPublished ?? false}
							{...getInputProps(fields.isPublished, {type: "checkbox"})}
							onChange={(e) => {
								fields.isPublished.onChange(e.target.checked);
							}}
						/>

					</div>

					<hr/>

					{/* Action Buttons */}
					<div className="flex space-x-4">
						<Button type="submit">Save</Button>
						<Link to={`../../`}>
							<Button variant="outline">Cancel</Button>
						</Link>

						{episode && (
							<span className="ml-auto">
								<DeleteDialog
									verificationString={episode?.title}
									placeholder="Enter podcast title"
								/>
							</span>
						)}
					</div>
				</Form>
			</FormProvider>
		</main>
	)
}
