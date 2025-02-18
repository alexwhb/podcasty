import { useState, useRef } from 'react'
import { json, redirect } from '@remix-run/server-runtime'
import { Form, useLoaderData } from 'react-router'
import { z } from 'zod'
import {
	FormProvider,
	getInputProps,
	getTextareaProps,
	useForm,
} from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { prisma } from '#app/utils/db.server.ts'

// ShadCN UI components
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Textarea } from '#app/components/ui/textarea'
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from '#app/components/ui/select.tsx'
import { Plus } from 'lucide-react'
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
} from '#app/components/ui/alert-dialog'
import { ErrorList } from '#app/components/forms.tsx'
import { LANGUAGES } from '#app/lib/utils.ts'

// --- Constants & Zod Schema

const PodcastEditorSchema = z.object({
	title: z.string().min(1, 'Title is required.').max(100),
	description: z.string().min(1, 'Description is required.').max(10000),
	author: z.string().min(1, 'Author is required.').max(100),
	language: z.string(),
	// We pass categories as a comma-separated string.
	category: z.string().optional(),
})

export type PodcastEditor = z.infer<typeof PodcastEditorSchema>

// --- Loader & Action

export async function loader({ params }: { params: { id: string } }) {
	const podcast = await prisma.podcast.findUnique({
		where: { id: params.id },
	})

	if (!podcast) {
		throw new Response('Podcast not found', { status: 404 })
	}

	// For the sidebar, load the user's podcasts.
	// (Assumes that podcast.userId exists.)
	const podcasts = await prisma.podcast.findMany({
		where: { ownerId: 'cm79grfzw000ccdg8g5t61gyz' }, // TODO UPDATE ME!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	})

	return json({ podcast, podcasts })
}

export async function action({
	request,
	params,
}: {
	request: Request
	params: { id: string }
}) {
	const formData = await request.formData()
	const actionType = formData.get('_action')

	if (actionType === 'delete') {
		const confirmName = formData.get('confirmName')
		const podcast = await prisma.podcast.findUnique({
			where: { id: params.id },
		})
		if (!podcast) {
			throw new Response('Podcast not found', { status: 404 })
		}

		if (typeof confirmName !== 'string' || confirmName !== podcast.title) {
			return json({ error: 'Podcast name does not match.' }, { status: 400 })
		}

		await prisma.podcast.delete({ where: { id: params.id } })
		return redirect('/podcasts')
	}

	// Otherwise, perform the update action.
	const parsed = parseWithZod(formData, { schema: PodcastEditorSchema })
	if (!parsed.value) {
		return json({ errors: parsed.errors }, { status: 400 })
	}

	const { title, description, author, language, category } = parsed.value

	await prisma.podcast.update({
		where: { id: params.id },
		data: { title, description, author, language, category },
	})

	return json({ success: true })
}

// --- UI Components

// Sidebar updated to receive an array of podcast objects.
function PodcastSidebar({
	podcasts,
	sidebarOpen,
}: {
	podcasts: Array<{ id: number | string; title: string }>
	sidebarOpen: boolean
}) {
	return (
		<aside
			className={`w-64 flex-shrink-0 border-r bg-background transition-transform duration-300 ease-in-out ${
				sidebarOpen ? 'translate-x-0' : '-translate-x-full'
			} md:translate-x-0`}
		>
			<div className="flex h-full flex-col">
				<div className="p-4">
					<h2 className="text-lg font-semibold">My Podcasts</h2>
				</div>
				<nav className="flex-1 overflow-y-auto">
					<ul className="space-y-1 p-2">
						{podcasts.map((podcast) => (
							<li key={podcast.id}>
								<Button variant="ghost" className="w-full justify-start">
									{podcast.title}
								</Button>
							</li>
						))}
					</ul>
				</nav>
				<div className="p-4">
					<Button className="w-full">
						<Plus className="mr-2 h-4 w-4" /> Add Podcast
					</Button>
				</div>
			</div>
		</aside>
	)
}

// Alert dialog for podcast deletion confirmation.
function DeletePodcastDialog({ podcastTitle }: { podcastTitle: string }) {
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
						<strong>{podcastTitle}</strong> to confirm deletion.
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
							disabled={confirmInput !== podcastTitle}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</form>
			</AlertDialogContent>
		</AlertDialog>
	)
}

// --- Main Edit Podcast Component

export default function EditPodcast() {
	const { podcast, podcasts } = useLoaderData<typeof loader>()
	const [sidebarOpen, setSidebarOpen] = useState(false)
	const [selectedLanguage, setSelectedLanguage] = useState(
		podcast.language || 'en',
	)
	const [tags, setTags] = useState<string[]>(
		podcast.category ? podcast.category.split(',') : [],
	)
	const [tagInput, setTagInput] = useState('')

	const [form, fields] = useForm({
		id: 'podcast-editor',
		constraint: getZodConstraint(PodcastEditorSchema),
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: PodcastEditorSchema })
		},
		defaultValue: {
			title: podcast.title,
			description: podcast.description,
			author: podcast.author,
			language: podcast.language || 'en',
			category: podcast.category || '',
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
		<div className="container mx-auto flex h-[calc(100vh-8rem)]">
			{/* Sidebar */}
			<PodcastSidebar podcasts={podcasts} sidebarOpen={sidebarOpen} />

			{/* Main content area */}
			<main className="flex-1 overflow-y-auto p-6">
				<Button
					variant="outline"
					size="sm"
					className="mb-4 md:hidden"
					onClick={() => setSidebarOpen(!sidebarOpen)}
				>
					{sidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
				</Button>
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
				<div className="mt-8">
					<DeletePodcastDialog podcastTitle={podcast.title} />
				</div>
			</main>
		</div>
	)
}
