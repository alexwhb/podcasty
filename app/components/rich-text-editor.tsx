import {
	FontBoldIcon,
	FontItalicIcon,
	UnderlineIcon,
	Link1Icon,
} from '@radix-ui/react-icons'

import * as Tooltip from '@radix-ui/react-tooltip'
import React, {
	type ReactNode,
	useCallback,
	useMemo,
	useState,
	useEffect,
} from 'react'
import { type JSX } from 'react/jsx-runtime'
import {
	createEditor,
	Editor,
	type Descendant,
	Element as SlateElement,
	type BaseEditor,
} from 'slate'
import { withHistory } from 'slate-history'
import {
	Editable,
	withReact,
	useSlate,
	Slate,
	type RenderLeafProps,
	type RenderElementProps,
} from 'slate-react'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

type Element = {
	type: string
	url?: string
	children: Descendant[]
}

declare module 'slate' {
	interface CustomTypes {
		Editor: BaseEditor
		Element: Element
		Text: {
			text: string
			bold?: boolean
			italic?: boolean
			underline?: boolean
		}
	}
}

const sanitizeSlateData = (nodes: Descendant[]): Descendant[] => {
	return nodes
		.map((node) => {
			if (SlateElement.isElement(node)) {
				// Filter out nodes with no children or empty children arrays
				if (!node.children || node.children.length === 0) {
					return null // Mark this node for removal
				}

				// Recursively sanitize children
				node.children = sanitizeSlateData(node.children)

				// If the node still has no valid children after sanitization, remove it
				if (node.children.length === 0) {
					return null
				}
			}

			return node
		})
		.filter(Boolean) as Descendant[] // Remove null nodes
}

const ensureHTML = (text: string): string => {
	// Simple check: if the string doesn't contain any HTML tag, wrap it in <p> tags
	const htmlRegex = /<\/?[a-z][\s\S]*>/i
	return htmlRegex.test(text) ? text : `<p>${text}</p>`
}

// Function to deserialize HTML into Slate-compatible format
const deserialize = (html: string): Descendant[] => {
	const parser = new DOMParser()
	const doc = parser.parseFromString(html, 'text/html')

	const deserializeNode = (node: ChildNode): Descendant | null => {
		if (node.nodeType === Node.TEXT_NODE) {
			return { text: node.textContent || '' }
		}

		if (node.nodeType !== Node.ELEMENT_NODE) {
			return null
		}

		const element = node as HTMLElement

		switch (element.tagName.toLowerCase()) {
			case 'p':
				return {
					type: 'paragraph',
					children: Array.from(element.childNodes)
						.map(deserializeNode)
						.filter(Boolean) as Descendant[],
				}
			case 'strong':
				return {
					text: element.textContent || '',
					bold: true,
				}
			case 'em':
				return {
					text: element.textContent || '',
					italic: true,
				}
			case 'u':
				return {
					text: element.textContent || '',
					underline: true,
				}
			case 'a': // Handle <a> tags
				return {
					type: 'link',
					url: element.getAttribute('href') || '',
					children: Array.from(element.childNodes)
						.map(deserializeNode)
						.filter(Boolean) as Descendant[],
				}
			case 'ul':
				return {
					type: 'bulleted-list',
					children: Array.from(element.childNodes)
						.map(deserializeNode)
						.filter(Boolean) as Descendant[],
				}
			case 'li':
				return {
					type: 'list-item',
					children: Array.from(element.childNodes)
						.map(deserializeNode)
						.filter(Boolean) as Descendant[],
				}
			default:
				return {
					type: 'paragraph',
					children: Array.from(element.childNodes)
						.map(deserializeNode)
						.filter(Boolean) as Descendant[],
				}
		}
	}

	const body = doc.body
	return Array.from(body.childNodes)
		.map(deserializeNode)
		.filter(Boolean) as Descendant[]
}

/**
 * This converts our output back into HTML so we can save it to our db.
 */
export const serialize = (nodes: Descendant[]): string => {
	return nodes
		.map((node) => {
			if (SlateElement.isElement(node)) {
				switch (node.type) {
					case 'paragraph':
						return `<p>${serialize(node.children)}</p>`
					case 'bulleted-list':
						return `<ul>${serialize(node.children)}</ul>`
					case 'list-item':
						return `<li>${serialize(node.children)}</li>`
					case 'link':
						return `<a href="${node.url}" target="_blank" rel="noopener noreferrer">${serialize(
							node.children,
						)}</a>`
					default:
						return `<p>${serialize(node.children)}</p>`
				}
			}

			// Handle text nodes with formatting (bold, italic, underline)
			if (node.text) {
				let text = node.text
				if (node.bold) {
					text = `<strong>${text}</strong>`
				}
				if (node.italic) {
					text = `<em>${text}</em>`
				}
				if (node.underline) {
					text = `<u>${text}</u>`
				}
				return text
			}

			return ''
		})
		.join('')
}

const RichTextEditor = ({
	initialHTML,
	onChange,
}: {
	initialHTML?: string
	onChange: (element: Element) => void
}) => {
	const initialValue = useMemo(() => {
		try {
			if (initialHTML) {
				// Make sure that the value passed to deserialize is valid HTML. If it's not it will cause
				// a lot of issues.
				const processedHTML = ensureHTML(initialHTML)
				const parsed = deserialize(processedHTML)
				return sanitizeSlateData(parsed)
			} else {
				return [{ type: 'paragraph', children: [{ text: '' }] }]
			}
		} catch (error) {
			console.error('Error parsing initial HTML:', error)
			return [{ type: 'paragraph', children: [{ text: '' }] }]
		}
	}, [initialHTML])

	const [value, setValue] = useState<Descendant[]>(initialValue)
	// Wrap the editor with `withHistory` for undo/redo support
	const editor = useMemo(() => withHistory(withReact(createEditor())), [])

	useEffect(() => {
		onChange(serialize(value))
	}, [value])

	const renderElement = useCallback(
		(
			props: JSX.IntrinsicAttributes & {
				attributes: any
				children: any
				element: any
			},
		) => <Element {...props} />,
		[],
	)
	const renderLeaf = useCallback(
		(
			props: JSX.IntrinsicAttributes & {
				attributes: any
				children: any
				leaf: any
			},
		) => (
			<Leaf
				text={{
					text: '',
					bold: undefined,
					italic: undefined,
					underline: undefined,
				}}
				{...props}
			/>
		),
		[],
	)

	// Handle keyboard shortcuts
	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.ctrlKey || event.metaKey) {
			switch (event.key) {
				case 'b': // Bold
					event.preventDefault()
					toggleMark(editor, 'bold')
					break
				case 'i': // Italic
					event.preventDefault()
					toggleMark(editor, 'italic')
					break
				case 'u': // Underline
					event.preventDefault()
					toggleMark(editor, 'underline')
					break
				default:
					break
			}
		}
	}

	if (typeof window === 'undefined') {
		return null
	}

	return (
		<Slate editor={editor} initialValue={value} onChange={setValue}>
			<ToggleGroup type="multiple" className="flex justify-start gap-1 p-2">
				<TooltipComponent content="Bold">
					<MarkToggle format="bold">
						<FontBoldIcon />
					</MarkToggle>
				</TooltipComponent>

				<TooltipComponent content="Italic">
					<MarkToggle format="italic">
						<FontItalicIcon />
					</MarkToggle>
				</TooltipComponent>

				<TooltipComponent content="Underline">
					<MarkToggle format="underline">
						<UnderlineIcon />
					</MarkToggle>
				</TooltipComponent>

				<TooltipComponent content="link">
					<MarkToggle format="link">
						<Link1Icon />
					</MarkToggle>
				</TooltipComponent>
			</ToggleGroup>

			<Editable
				className="min-h-[200px] rounded-md border border-input bg-transparent p-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				renderElement={renderElement}
				renderLeaf={renderLeaf}
				placeholder="Input description here..."
				onKeyDown={handleKeyDown} // Add keyboard shortcut handler
				spellCheck
			/>
		</Slate>
	)
}

// Tooltip component
const TooltipComponent = ({
	children,
	content,
}: {
	children: React.ReactNode
	content: string
}) => (
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger>{children}</Tooltip.Trigger>
			<Tooltip.Portal>
				<Tooltip.Content
					className="rounded bg-gray-800 px-2 py-1 text-sm text-white"
					sideOffset={5}
				>
					{content}
					<Tooltip.Arrow className="fill-gray-800" />
				</Tooltip.Content>
			</Tooltip.Portal>
		</Tooltip.Root>
	</Tooltip.Provider>
)

interface MarkToggleProps {
	format: string
	children: ReactNode
}

// Radix-powered Toggle components
const MarkToggle: React.FC<MarkToggleProps> = ({ format, children }) => {
	const editor = useSlate()
	const active = isMarkActive(editor, format)

	return (
		<ToggleGroupItem
			value={format}
			data-state={active ? 'on' : 'off'} // ShadCN uses `data-state` for styling
			aria-pressed={active} // Accessibility
			onMouseDown={(e) => {
				e.preventDefault()
				toggleMark(editor, format)
			}}
		>
			{children}
		</ToggleGroupItem>
	)
}

const toggleMark = (editor: BaseEditor, format: string) => {
	const isActive = isMarkActive(editor, format)
	console.log(isActive, format)

	if (isActive) {
		Editor.removeMark(editor, format)
	} else {
		Editor.addMark(editor, format, true)
	}
}
const isMarkActive = (
	editor: BaseEditor,
	format: keyof CustomText,
): boolean => {
	const marks = Editor.marks(editor) as CustomText | null
	return marks ? marks[format] === true : false
}

// Element and Leaf components remain mostly the same
const Element: React.FC<RenderElementProps> = ({
	attributes,
	children,
	element,
}) => {
	switch (element.type) {
		case 'bulleted-list':
			return <ul {...attributes}>{children}</ul>
		case 'list-item':
			return <li {...attributes}>{children}</li>
		case 'link': // Render <a> tags for links
			return (
				<a
					{...attributes}
					href={element.url}
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-600"
				>
					{children}
				</a>
			)
		default:
			return (
				<p className="py-2" {...attributes}>
					{children}
				</p>
			)
	}
}

const Leaf: React.FC<RenderLeafProps> = ({ attributes, children, leaf }) => {
	if (leaf.bold) children = <b>{children}</b>
	if (leaf.italic) children = <i>{children}</i>
	if (leaf.underline) children = <u>{children}</u>
	return <span {...attributes}>{children}</span>
}
export default RichTextEditor
