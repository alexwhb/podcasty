import {useState} from 'react'

import {
	FormProvider,
	getFormProps,
	getInputProps,
	getFieldsetProps,
	getTextareaProps,
	useForm,
} from '@conform-to/react'
import {Info} from './+types/podcasts.$podcastId.edit'
import {z} from 'zod'
import {getZodConstraint, parseWithZod} from '@conform-to/zod'
import {Form, Link} from 'react-router'
import {Input} from '#app/components/ui/input.tsx'
import {Button} from '#app/components/ui/button.tsx'
import {Label} from '#app/components/ui/label.tsx'
import {Spacer} from '#app/components/spacer.tsx'
import { cn, getNoteImgSrc, useIsPending } from '#app/utils/misc.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import MinimalEditor from '#app/components/rich-text-editor.tsx'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '#app/components/ui/select.tsx'

import {Field, TagField} from '#app/components/forms.tsx'
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
import {Switch} from '#app/components/ui/switch.tsx'
import {ErrorList} from '#app/components/forms.tsx'
import {Descendant} from 'slate'
import {Trash} from 'lucide-react'
import {LANGUAGES} from '#app/lib/utils.ts'


// TODO move this out into it's own file, so we can easily reuse it.
export const MAX_UPLOAD_SIZE = 1024 * 1024 * 10 // 10MB

const ImageFieldsetSchema = z.object({
  id: z.string().optional(),
  file: z
    .instanceof(File, { message: 'A valid image file is required if provided' })
    .optional()
    .refine(
      (file) => !file || file.size <= MAX_UPLOAD_SIZE,
      `File size must be less than ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`,
    )
    .refine(
      (file) => !file || ['image/jpeg', 'image/png'].includes(file.type),
      'File must be a JPEG or PNG image',
    )
});

export const PodcastEditorSchema = z.object({
	id: z.string().optional(),
	title: z.string().min(1, 'Title is required.').max(100),
	description: z.string().min(1, 'Description is required.').max(10000),
	author: z.string().min(1, 'Author is required.').max(100), // todo probablye the user's name by default
	language: z.string(),
	// We pass categories as a comma-separated string.
	category: z.string().min(1, 'Category is required.').max(500),
	type: z.enum(['episodic', 'serial']),
	locked: z.boolean().default(false),
	explicit: z.boolean().default(false),
	baseUrl: z.string().url(),
	image: ImageFieldsetSchema,
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
				<Button variant="destructive">
					<Trash/>
				</Button>
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
					<input type="hidden" name="_action" value="delete"/>
					<div className="m-4">
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
										  actionData,
									  }: {
	podcast?: Info['loaderData']['podcast']
	actionData?: Info['actionData']
}) {
	const [selectedLanguage, setSelectedLanguage] = useState(
		podcast?.language || 'en',
	)

	const [selectedType, setSelectedType] = useState(
		podcast?.type || 'episodic'
	)

	const [tags, setTags] = useState<string[]>(
		podcast?.category ? podcast.category.split(',') : [],
	)
	const [tagInput, setTagInput] = useState('')

	const [editorContent, setEditorContent] = useState<string>(
		podcast?.description || '',
	)

	const [form, fields] = useForm({
		id: 'podcast-editor',
		constraint: getZodConstraint(PodcastEditorSchema),
		lastResult: actionData?.result,
		onValidate({formData}) {
			const res = parseWithZod(formData, {schema: PodcastEditorSchema})
			console.log(res)
			return res
		},
		defaultValue: {
			title: podcast?.title || '',
			description: podcast?.description || '',
			author: podcast?.author || '',
			language: podcast?.language || 'en',
			category: podcast?.category || '',
			type: podcast?.type || 'episodic',
			explicit: podcast?.explicit || false,
			locked: podcast?.locked || false,
			baseUrl: podcast?.baseUrl,
			image: podcast?.image ?? {},
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
				<Form
					method="post"
					{...getFormProps(form)}
					className="space-y-6"
					encType="multipart/form-data"
				>
					{/*
					This hidden submit button is here to ensure that when the user hits
					"enter" on an input field, the primary form function is submitted
					rather than the first button in the form (which is delete/add image).
				*/}
					<button type="submit" className="hidden"/>
					{podcast ? (
						<input type="hidden" name="id" value={podcast?.id}/>
					) : null}
					<div>
  <Label>Image</Label>
					  <div className="relative">
					    {/* If an image exists, show a remove button */}
					    {fields.image.value && (
					      <Button
							  variant="destructive"
					        className="absolute left-0 top-0 z-10"
					        {...form.remove.getButtonProps({
					          name: fields.image.name,
					        })}
					      >
					        <span aria-hidden>
					          <Icon name="cross-1" />
					        </span>{' '}
					        <span className="sr-only">Remove image</span>
					      </Button>
					    )}
					    <ImageChooser meta={fields.image} />
					  </div>
					</div>
					<Field
						labelProps={{children: 'Title'}}
						inputProps={{
							...getInputProps(fields.title, {type: 'text'}),
							placeholder: 'Podcast title',
						}}
						errors={fields.title.errors}
					/>
					{/* Description Field with RichTextEditor */}
					<div>
						<Label htmlFor="description">Description</Label>
						<MinimalEditor
							initialHTML={podcast?.description}
							onChange={(html) => setEditorContent(html)}
						/>

						{/* Hidden input to submit serialized HTML */}
						<input
							type="hidden"
							name="description"
							value={editorContent} // Serialize the editor's content to HTML
						/>
					</div>

					{/* Author Field */}
					<Field
						labelProps={{children: 'Author'}}
						inputProps={{
							...getInputProps(fields.author, {type: 'text'}),
							placeholder: 'John Doe',
						}}
						errors={fields.author.errors}
					/>

					{/* Base URL Field */}
					<Field
						labelProps={{children: 'Base Podcast URL'}}
						inputProps={{
							...getInputProps(fields.baseUrl, {type: 'text'}),
							placeholder: 'https://mypodcast.com',
						}}
						errors={fields.baseUrl.errors}
					/>

					{/* Language Dropdown */}
					<div>
						<Label htmlFor="language">Language</Label>
						<Select
							value={selectedLanguage}
							onValueChange={(value: string) => {
								setSelectedLanguage(value)
								console.log(value)
							}}
						>
							<SelectTrigger id="language">
								<SelectValue placeholder="Select a language"/>
							</SelectTrigger>
							<SelectContent>
								{LANGUAGES.map((lang) => (
									<SelectItem key={lang.value} value={lang.value}>
										{lang.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{/* Hidden input to submit language */}
						<input
							type="hidden"
							name="language"
							value={selectedLanguage} // Serialize the editor's content to HTML
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
								<SelectItem value={'episodic'}>
									Episodic
								</SelectItem>
								<SelectItem value={'serial'}>
									Serial
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

					{/* Categories Tag Input */}

					<TagField
						labelProps={{children: 'Categories (Tags)'}}
						tags={tags}
						setTags={setTags}
						errors={fields.category.errors}
					/>

					{/* Explicit Switch */}
					<div className="flex items-center space-x-2 py-2">
						<Label htmlFor="explicit">Explicit</Label>
						<Switch
							id="explicit"
							defaultChecked={podcast?.explicit ?? false}
							{...getInputProps(fields.explicit, {type: "checkbox"})}

							onChange={(e) => {
								fields.explicit.onChange(e.target.checked);
							}}
						/>
						<span className="px-4"></span>
						<Label htmlFor="locked">Is Locked</Label>
						<Switch
							id="locked"
							defaultChecked={podcast?.locked ?? true}
							{...getInputProps(fields.locked, {type: "checkbox"})}
							onChange={(e) => {
								fields.locked.onChange(e.target.checked);
							}}
						/>
					</div>

					<hr/>

					<div className="flex gap-4 border-top">
						<Link to="../">
							<Button variant="outline">Cancel</Button>
						</Link>
						<Button type="submit">Save</Button>


						{podcast && (
							<span className="ml-auto">
      <DeletePodcastDialog verificationString={podcast.title}/>
    </span>
						)}
					</div>

					<ErrorList id={form.errorId} errors={form.errors}/>
				</Form>
			</FormProvider>
		</main>
	)
}



function ImageChooser({ meta }: { meta: FieldMetadata<ImageFieldset> }) {
	const fields = meta.getFieldset()
	const existingImage = Boolean(fields.id.initialValue)
	const [previewImage, setPreviewImage] = useState<string | null>(
		fields.id.initialValue ? getNoteImgSrc(fields.id.initialValue) : null,
	)
	const [altText, setAltText] = useState(fields.altText.initialValue ?? '')

	return (
		<fieldset {...getFieldsetProps(meta)}>
			<div className="flex gap-3">
				<div className="w-32">
					<div className="relative h-32 w-32">
						<label
							htmlFor={fields.file.id}
							className={cn('group absolute h-32 w-32 rounded-lg', {
								'bg-accent opacity-40 focus-within:opacity-100 hover:opacity-100':
									!previewImage,
								'cursor-pointer focus-within:ring-2': !existingImage,
							})}
						>
							{previewImage ? (
								<div className="relative">
									<img
										src={previewImage}
										alt={altText ?? ''}
										className="h-32 w-32 rounded-lg object-cover"
									/>
									{/*{existingImage ? null : (*/}
									{/*	<div className="pointer-events-none absolute -right-0.5 -top-0.5 rotate-12 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-md">*/}
									{/*		new*/}
									{/*	</div>*/}
									{/*)}*/}
								</div>
							) : (
								<div className="flex h-32 w-32 items-center justify-center rounded-lg border border-muted-foreground text-4xl text-muted-foreground">
									<Icon name="plus" />
								</div>
							)}
							{existingImage ? (
								<input {...getInputProps(fields.id, { type: 'hidden' })} />
							) : null}
							<input
								aria-label="Image"
								className="absolute left-0 top-0 z-0 h-32 w-32 cursor-pointer opacity-0"
								onChange={(event) => {
									const file = event.target.files?.[0]

									if (file) {
										const reader = new FileReader()
										reader.onloadend = () => {
											setPreviewImage(reader.result as string)
										}
										reader.readAsDataURL(file)
									} else {
										setPreviewImage(null)
									}
								}}
								accept="image/*"
								{...getInputProps(fields.file, { type: 'file' })}
							/>
						</label>
					</div>
					<div className="min-h-[12px] px-4 pb-3 pt-1">
						<ErrorList id={fields.file.errorId} errors={fields.file.errors} />
					</div>
				</div>
			</div>
			<div className="min-h-[12px] px-4 pb-3 pt-1">
				<ErrorList id={meta.errorId} errors={meta.errors} />
			</div>
		</fieldset>
	)
}
