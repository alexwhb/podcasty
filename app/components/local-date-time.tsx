import { useHydrated } from 'remix-utils/use-hydrated'

/**
 * A date in the visitor's locale and time zone. The server can't know either,
 * so the server render (and the first client render, to match it) uses en-US
 * in UTC, then it switches after hydration. Formatting directly in render
 * caused hydration errors for anyone outside UTC.
 */
export function LocalDateTime({
	value,
	options,
}: {
	value: Date | string
	options?: Intl.DateTimeFormatOptions
}) {
	const isHydrated = useHydrated()
	const date = new Date(value)
	const text = isHydrated
		? date.toLocaleString(undefined, options)
		: date.toLocaleString('en-US', { ...options, timeZone: 'UTC' })
	return <time dateTime={date.toISOString()}>{text}</time>
}
