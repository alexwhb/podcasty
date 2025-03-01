import { useInputControl } from '@conform-to/react'
import { REGEXP_ONLY_DIGITS_AND_CHARS, type OTPInputProps } from 'input-otp'
import React, { useId } from 'react'
import MinimalEditor from './rich-text-editor.tsx'
import { Button } from './ui/button.tsx'
import { Checkbox } from './ui/checkbox.tsx'
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from './ui/input-otp.tsx'
import { Input } from './ui/input.tsx'
import { Label } from './ui/label.tsx'
import { Textarea } from './ui/textarea.tsx'
import { NumberInput } from '#app/components/ui/number-input.tsx'
export type ListOfErrors = Array<string | null | undefined> | null | undefined

export function ErrorList({
	id,
	errors,
}: {
	errors?: ListOfErrors
	id?: string
}) {
	const errorsToRender = errors?.filter(Boolean)
	if (!errorsToRender?.length) return null
	return (
		<ul id={id} className="flex flex-col gap-1">
			{errorsToRender.map((e) => (
				<li key={e} className="text-[10px] text-foreground-destructive">
					{e}
				</li>
			))}
		</ul>
	)
}

export function Field({
	labelProps,
	inputProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	inputProps: React.InputHTMLAttributes<HTMLInputElement>
	errors?: ListOfErrors
	className?: string
}) {
	const fallbackId = useId()
	const id = inputProps.id ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined

	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<Input
				id={id}
				aria-invalid={errorId ? true : undefined}
				aria-describedby={errorId}
				{...inputProps}
			/>
			<div className="min-h-[12px] px-4 pb-3 pt-1">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	)
}



export function OTPField({
	labelProps,
	inputProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	inputProps: Partial<OTPInputProps & { render: never }>
	errors?: ListOfErrors
	className?: string
}) {
	const fallbackId = useId()
	const id = inputProps.id ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<InputOTP
				pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
				maxLength={6}
				id={id}
				aria-invalid={errorId ? true : undefined}
				aria-describedby={errorId}
				{...inputProps}
			>
				<InputOTPGroup>
					<InputOTPSlot index={0} />
					<InputOTPSlot index={1} />
					<InputOTPSlot index={2} />
				</InputOTPGroup>
				<InputOTPSeparator />
				<InputOTPGroup>
					<InputOTPSlot index={3} />
					<InputOTPSlot index={4} />
					<InputOTPSlot index={5} />
				</InputOTPGroup>
			</InputOTP>
			<div className="min-h-[32px] px-4 pb-3 pt-1">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	)
}

export function TextareaField({
	labelProps,
	textareaProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	textareaProps: React.TextareaHTMLAttributes<HTMLTextAreaElement>
	errors?: ListOfErrors
	className?: string
}) {
	const fallbackId = useId()
	const id = textareaProps.id ?? textareaProps.name ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<Textarea
				id={id}
				aria-invalid={errorId ? true : undefined}
				aria-describedby={errorId}
				{...textareaProps}
			/>
			<div className="min-h-[12px] px-4 pb-3 pt-1">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	)
}

export function CheckboxField({
	labelProps,
	buttonProps,
	errors,
	className,
}: {
	labelProps: React.ComponentProps<'label'>
	buttonProps: CheckboxProps & {
		name: string
		form: string
		value?: string
	}
	errors?: ListOfErrors
	className?: string
}) {
	const { key, defaultChecked, ...checkboxProps } = buttonProps
	const fallbackId = useId()
	const checkedValue = buttonProps.value ?? 'on'
	const input = useInputControl({
		key,
		name: buttonProps.name,
		formId: buttonProps.form,
		initialValue: defaultChecked ? checkedValue : undefined,
	})
	const id = buttonProps.id ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined

	return (
		<div className={className}>
			<div className="flex gap-2">
				<Checkbox
					{...checkboxProps}
					id={id}
					aria-invalid={errorId ? true : undefined}
					aria-describedby={errorId}
					checked={input.value === checkedValue}
					onCheckedChange={(state) => {
						input.change(state.valueOf() ? checkedValue : '')
						buttonProps.onCheckedChange?.(state)
					}}
					onFocus={(event) => {
						input.focus()
						buttonProps.onFocus?.(event)
					}}
					onBlur={(event) => {
						input.blur()
						buttonProps.onBlur?.(event)
					}}
					type="button"
				/>
				<label
					htmlFor={id}
					{...labelProps}
					className="self-center text-body-xs text-muted-foreground"
				/>
			</div>
			<div className="px-4 pb-3 pt-1">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	)
}


export function TagField({
  labelProps,
  inputProps,
  tags,
  setTags,
  errors,
  className,
}: {
  labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  tags: string[]
  setTags: React.Dispatch<React.SetStateAction<string[]>>
  errors?: ListOfErrors
  className?: string
}) {
  const fallbackId = useId()
  const id = inputProps?.id ?? fallbackId
  const errorId = errors?.length ? `${id}-error` : undefined
  const [tagInput, setTagInput] = React.useState('')

  const addTag = () => {
    const trimmedTag = tagInput.trim()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

console.log(errorId)
  return (
    <div className={className}>
      <Label htmlFor={id} {...labelProps} />
      <div className="mt-1 flex flex-wrap gap-2 rounded-md border p-2">
        {tags.map((tag, index) => (
          <div
            key={index}
            className="flex items-center gap-1 rounded-md border px-2 text-sm"
          >
            <span>{tag}</span>
            <Button
              variant="ghost"
              type="button"
              onClick={() => removeTag(tag)}
              className=""
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
          className="flex-1 border-none focus-visible:ring-0 focus-visible:ring-offset-0"
          id={id}
          aria-invalid={errorId ? true : undefined}
          aria-describedby={errorId}
          {...inputProps}
        />
        {/* Hidden field to submit categories as CSV */}
        <input type="hidden" name="category" value={tags.join(',')} />
      </div>
      <div className="min-h-[12px] px-4 pb-3 pt-1">
        {errorId ? <ErrorList id={errorId} errors={errors} /> : null}
      </div>
    </div>
  )
}

export function MinimalEditorField({
																		 labelProps,
																		 editorProps,
																		 initialHTML,
																		 onChange,
																		 errors,
																		 className,
																	 }: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	editorProps?: React.HTMLAttributes<HTMLDivElement>
	initialHTML?: string
	onChange: (html: string) => void
	errors?: ListOfErrors
	className?: string
}) {
	const fallbackId = useId()
	const id = editorProps?.id ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined
	const [editorContent, setEditorContent] = React.useState(initialHTML || '')

	// Handle editor content changes
	const handleEditorChange = (html: string) => {
		setEditorContent(html)
		onChange(html)
	}

	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<div
				id={id}
				aria-invalid={errorId ? true : undefined}
				aria-describedby={errorId}
				{...editorProps}
			>
				<MinimalEditor
					initialHTML={initialHTML}
					onChange={handleEditorChange}
				/>
			</div>

			{/* Hidden input to submit serialized HTML */}
			<input
				type="hidden"
				name={labelProps.htmlFor?.toString().toLowerCase() || 'editor-content'}
				value={editorContent}
			/>

			<div className="min-h-[12px] px-4 pb-3 pt-1">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	)
}

export function NumberField({
															labelProps,
															inputProps,
															value,
															onChange,
															errors,
															className,
															min,
															max,
															step,
															controls = true,
														}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>
	inputProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'min' | 'max' | 'step'>
	value: number
	onChange: (value: number) => void
	min?: number
	max?: number
	step?: number
	controls?: boolean
	errors?: ListOfErrors
	className?: string
}) {
	const fallbackId = useId()
	const id = inputProps?.id ?? fallbackId
	const errorId = errors?.length ? `${id}-error` : undefined

	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<NumberInput
				id={id}
				value={value}
				onChange={onChange}
				min={min}
				max={max}
				step={step}
				controls={controls}
				aria-invalid={errorId ? true : undefined}
				aria-describedby={errorId}
				{...inputProps}
			/>
			<div className="min-h-[12px] px-4 pb-3 pt-1">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	)
}