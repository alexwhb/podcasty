import { useState } from 'react'

import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import {
	FormProvider,
	getFormProps,
	getInputProps,
	useForm,
} from '@conform-to/react'
import { Form, Link } from 'react-router'
import { Input } from '#app/components/ui/input'
import { Label } from '#app/components/ui/label'
import { Button } from '#app/components/ui/button'
import { Switch } from '#app/components/ui/switch'
import { Calendar } from '#app/components/ui/calendar'
import MinimalEditor from '#app/components/rich-text-editor.tsx'
import {
	Popover,
	PopoverTrigger,
	PopoverContent,
} from '#app/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { Descendant } from 'slate'

import { Info } from './+types/podcasts.$podcastId.episode.$episodeId.edit'
import { z } from 'zod'
import { format } from 'date-fns/format'

export const EpisodeEditorSchema = z.object({
	title: z.string().min(1, 'Title is required.').max(100),
	description: z.string().min(1, 'Description is required.').max(4000),
	// pubDate as a string in the desired format.
	pubDate: z.string().min(1, 'Publish date is required.'),

	season: z.number().optional(),

	episode: z.number().optional(),

	// explicit is represented as a boolean.
	explicit: z.boolean(),
})

export default function EpisodeEditor({
	episode,
}: {
	episode?: Info['loaderData']['podcast']
}) {
	//     actionData?: Info['actionData']

	console.log(typeof episode.pubDate)

	// const { podcastId } = useParams()
	// const actionData = useActionData()

	const [form, fields] = useForm({
		id: 'episode-editor',
		constraint: getZodConstraint(EpisodeEditorSchema),
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: EpisodeEditorSchema })
		},
		defaultValue: {
			title: episode.title,
			description: episode.description,
			// We convert the backend value into our desired string format.
			pubDate: format(new Date(episode.pubDate), 'dd-MM-yyyy HH:mm:ss'),
			explicit: episode.explicit,
		},
		shouldRevalidate: 'onBlur',
	})

	// Local state for the publish date as a Date object.
	const initialDate = new Date(episode.pubDate)
	const [selectedDate, setSelectedDate] = useState<Date>(initialDate)

	// Format function for display and submission.
	const formattedDate = format(selectedDate, 'dd-MM-yyyy HH:mm:ss')

	return (
		<main className="flex-1 overflow-y-auto p-6">
			<h1 className="mb-4 text-2xl font-bold">Edit Episode</h1>
			<FormProvider context={form.context}>
				<Form method="POST" {...getFormProps(form)} className="space-y-6">
					{/* Title Field */}
					<div>
						<Label htmlFor="title">Title</Label>
						<Input
							autoFocus
							placeholder="Enter episode title"
							{...getInputProps(fields.title, { type: 'text' })}
							className="mt-1 block w-full"
						/>
					</div>

					{/* Description Field */}
					<div>
						<Label htmlFor="description">Description</Label>
						<MinimalEditor
							initialHTML={episode?.description}
							onChange={function (element: {
								type: string
								url?: string
								children: Descendant[]
							}): void {
								throw new Error('Function not implemented.')
							}}
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
									onSelect={(date: Date | undefined) => {
										if (date) {
											setSelectedDate(date)
										}
									}}
									initialFocus
								/>
							</PopoverContent>
						</Popover>
						{/* Hidden input for pubDate */}
						<input type="hidden" name="pubDate" value={formattedDate} />
					</div>

					{/* Explicit Switch */}
					<div className="flex items-center space-x-2">
						<Label htmlFor="explicit">Explicit</Label>
						<Switch
							defaultChecked={episode?.explicit ?? false}
							{...getInputProps(fields.explicit, { type: 'checkbox' })}
						/>
					</div>

					{/* Action Buttons */}
					<div className="flex space-x-4">
						<Button type="submit">Save Changes</Button>
						<Link to={`../../`}>
							<Button variant="outline">Cancel</Button>
						</Link>
					</div>
				</Form>
			</FormProvider>
		</main>
	)
}
