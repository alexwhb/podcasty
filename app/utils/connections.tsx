// Social providers are disabled. Keeping exports as no-ops to avoid invasive refactors.
export const providerNames = [] as const
export const ProviderNameSchema = z.never()
export type ProviderName = never
export const providerLabels: Record<string, string> = {}
export const providerIcons: Record<string, React.ReactNode> = {}
export function ProviderConnectionForm() {
	return null
}
