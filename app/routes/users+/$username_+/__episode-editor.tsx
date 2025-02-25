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
import {Field} from '#app/components/forms.tsx'
import MinimalEditor from '#app/components/rich-text-editor.tsx'
import { Button } from '#app/components/ui/button'
import { Calendar } from '#app/components/ui/calendar'
import { Input } from '#app/components/ui/input'
import { Label } from '#app/components/ui/label'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '#app/components/ui/popover'
import { Switch } from '#app/components/ui/switch'
import DeleteDialog from "#app/components/delete-dialog.tsx";

export const EpisodeEditorSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(100),
  description: z.string().min(1, 'Description is required.').max(4000),
  pubDate: z.string().min(1, 'Publish date is required.'),
  season: z.number().optional(),
  episode: z.number().optional(),
  explicit: z.boolean(),
})

export default function EpisodeEditor({
  episode,
  actionData,
}) {
  // Memoize the initial date to avoid recalculation on re-renders
  const initialDate = useMemo(
    () => (episode?.pubDate ? new Date(episode.pubDate) : new Date()),
    [episode?.pubDate]
  )

  const [selectedDate, setSelectedDate] = useState(initialDate)

  // Memoize the formatted date
  const formattedDate = useMemo(
    () => format(selectedDate, 'dd-MM-yyyy HH:mm:ss'),
    [selectedDate]
  )

  // Memoize default values to prevent unnecessary recalculations
  const defaultValues = useMemo(
    () => ({
      title: episode?.title || '',
      description: episode?.description || '',
      pubDate: episode?.pubDate
        ? format(new Date(episode.pubDate), 'MM-dd-yyyy HH:mm:ss')
        : format(new Date(), 'MM-dd-yyyy HH:mm:ss'),
      explicit: episode?.explicit || false,
      season: episode?.season,
      episode: episode?.episode,
    }),
    [episode]
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

  const [editorContent, setEditorContent] = useState(episode?.description || '')

  // Memoize the editor change handler
  const handleEditorChange = useCallback((html) => {
    setEditorContent(html)
  }, [])

  // Memoize the date selection handler
  const handleDateSelect = useCallback((date) => {
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
					<div>
						<Field
							labelProps={{ children: 'Title' }}
							inputProps={{
								...getInputProps(fields.title, { type: 'text' }),
								placeholder: 'Episode title',
							}}
							errors={fields.title.errors}
						/>
					</div>

					{/* Description Field */}
					<div>
						<Label htmlFor="description">Description</Label>
						<MinimalEditor
							initialHTML={episode?.description}
							onChange={handleEditorChange}
						/>
						<input type="hidden" name="description" value={editorContent} />
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
									onSelect={handleDateSelect}
									initialFocus
								/>
							</PopoverContent>
						</Popover>
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
						<Button type="submit">Save</Button>
						<Link to={`../../`}>
							<Button variant="outline">Cancel</Button>
						</Link>

						{episode && (
							<span className="ml-auto">
								<DeleteDialog
									verificationString={episode?.title}
									placeholder='Enter podcast title'
								/>
							</span>
						)}
					</div>
				</Form>
			</FormProvider>
		</main>
	)
}
