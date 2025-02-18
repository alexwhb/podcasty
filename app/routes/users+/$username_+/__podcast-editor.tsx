import { useState } from 'react'

import {
	FormProvider,
	getInputProps,
	getTextareaProps,
	useForm,
} from '@conform-to/react'
import { Info } from './+types/podcasts.$podcastId'
import { z } from 'zod'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { Form } from 'react-router'
import { Input } from '#app/components/ui/input.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Label } from '#app/components/ui/label.tsx'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '#app/components/ui/select.tsx'
import { Textarea } from '#app/components/ui/textarea.tsx'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '#app/components/ui/alert-dialog.tsx'
import { ErrorList } from '#app/components/forms.tsx'

// --- Constants & Zod Schema
const LANGUAGES = [
	{ value: 'en', label: 'English' },
	{ value: 'es', label: 'Spanish' },
	{ value: 'fr', label: 'French' },
	{ value: 'de', label: 'German' },
	{ value: 'zh', label: 'Chinese' },
]

const PodcastEditorSchema = z.object({
	title: z.string().min(1, 'Title is required.').max(100),
	description: z.string().min(1, 'Description is required.').max(10000),
	author: z.string().min(1, 'Author is required.').max(100),
	language: z.string(),
	// We pass categories as a comma-separated string.
	category: z.string().optional(),
})

export type PodcastEditor = z.infer<typeof PodcastEditorSchema>

// Alert dialog for podcast deletion confirmation.
function DeletePodcastDialog({
	verificationString,
}: {
	verificationString: string
}) {
	const [confirmInput, setConfirmInput] = useState('')
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="destructive">Delete Podcast</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. Please type{' '}
						<strong>{verificationString}</strong> to confirm deletion.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<form method="post">
					<input type="hidden" name="_action" value="delete" />
					<div className="mt-2">
						<Input
							name="confirmName"
							placeholder="Podcast title"
							value={confirmInput}
							onChange={(e) => setConfirmInput(e.target.value)}
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel asChild>
							<Button variant="outline">Cancel</Button>
						</AlertDialogCancel>
						<AlertDialogAction
							type="submit"
							disabled={confirmInput !== verificationString}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</form>
			</AlertDialogContent>
		</AlertDialog>
	)
}

export default function PodcastEditor({
	podcast,
}: {
	podcast?: Info['loaderData']['podcast']
}) {
	const [selectedLanguage, setSelectedLanguage] = useState(
		podcast?.language || 'en',
	)
	const [tags, setTags] = useState<string[]>(
		podcast?.category ? podcast.category.split(',') : [],
	)
	const [tagInput, setTagInput] = useState('')

	const [form, fields] = useForm({
		id: 'podcast-editor',
		constraint: getZodConstraint(PodcastEditorSchema),
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: PodcastEditorSchema })
		},
		defaultValue: {
			title: podcast?.title || '',
			description: podcast?.description || '',
			author: podcast?.author || '',
			language: podcast?.language || 'en',
			category: podcast?.category || '',
		},
		shouldRevalidate: 'onBlur',
	})

	const addTag = () => {
		const trimmed = tagInput.trim()
		if (trimmed && !tags.includes(trimmed)) {
			setTags((prev) => [...prev, trimmed])
			setTagInput('')
		}
	}

	const removeTag = (tag: string) => {
		setTags((prev) => prev.filter((t) => t !== tag))
	}

	return (
		<main className="flex-1 overflow-y-auto p-6">
			<h1 className="mb-6 text-2xl font-bold">Edit Podcast Info</h1>
			<FormProvider context={form.context}>
				<Form method="post" {...form.props} className="space-y-6">
					{/* Title Field */}
					<div>
						<Label htmlFor="title">Title</Label>
						<Input
							id="title"
							autoFocus
							placeholder="Enter podcast title"
							{...getInputProps(fields.title, { type: 'text' })}
						/>
					</div>

					{/* Description Field as a plain text area */}
					<div>
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							rows={6}
							placeholder="Enter podcast description"
							{...getTextareaProps(fields.description)}
						/>
					</div>

					{/* Author Field */}
					<div>
						<Label htmlFor="author">Author</Label>
						<Input
							id="author"
							placeholder="Enter author"
							{...getInputProps(fields.author, { type: 'text' })}
						/>
					</div>

					{/* Language Dropdown */}
					<div>
						<Label htmlFor="language">Language</Label>
						<Select
							value={selectedLanguage}
							onValueChange={(value: string) => {
								setSelectedLanguage(value)
								form.setFieldValue('language', value)
							}}
						>
							<SelectTrigger id="language">
								<SelectValue placeholder="Select a language" />
							</SelectTrigger>
							<SelectContent>
								{LANGUAGES.map((lang) => (
									<SelectItem key={lang.value} value={lang.value}>
										{lang.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Categories Tag Input */}
					<div>
						<Label htmlFor="category">Categories (Tags)</Label>
						<div className="mt-1 flex flex-wrap gap-2 rounded-md border border-gray-300 p-2">
							{tags.map((tag, index) => (
								<div
									key={index}
									className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-sm text-indigo-800"
								>
									<span>{tag}</span>
									<Button
										variant="ghost"
										type="button"
										onClick={() => removeTag(tag)}
										className="p-0"
									>
										×
									</Button>
								</div>
							))}
							<Input
								type="text"
								value={tagInput}
								onChange={(e) => setTagInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault()
										addTag()
									}
								}}
								placeholder="Type tag and press Enter"
								className="flex-1"
							/>
						</div>
						{/* Hidden field to submit categories as CSV */}
						<input type="hidden" name="category" value={tags.join(',')} />
					</div>

					<Button type="submit">Save</Button>
					<ErrorList id={form.errorId} errors={form.errors} />
				</Form>
			</FormProvider>

			{/* Delete Podcast Section */}
			{podcast && (
				<div className="mt-8">
					<DeletePodcastDialog verificationString={podcast.title} />
				</div>
			)}
		</main>
	)
}
