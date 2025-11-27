import {
	data,
	Link,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
	useMatches,
	redirect,
} from 'react-router'
import { HoneypotProvider } from 'remix-utils/honeypot/react'
import logoIcon from '../public/podcasty.svg'
import { type Route } from './+types/root.ts'
import appleTouchIconAssetUrl from './assets/favicons/apple-touch-icon.png'
import faviconAssetUrl from './assets/favicons/favicon.svg'
import { GeneralErrorBoundary } from './components/error-boundary.tsx'
import { EpicProgress } from './components/progress-bar.tsx'
import { SearchBar } from './components/search-bar.tsx'
import { useToast } from './components/toaster.tsx'
import { href as iconsHref } from './components/ui/icon.tsx'
import { Toaster } from './components/ui/sonner.tsx'
import { UserDropdown } from './components/user-dropdown.tsx'
import {
	ThemeSwitch,
	useOptionalTheme,
	useTheme,
} from './routes/resources+/theme-switch.tsx'
import tailwindStyleSheetUrl from './styles/tailwind.css?url'
import { getUserId, logout } from './utils/auth.server.ts'
import { ClientHintCheck, getHints } from './utils/client-hints.tsx'
import { prisma } from './utils/db.server.ts'
import { getEnv } from './utils/env.server.ts'
import { pipeHeaders } from './utils/headers.server.ts'
import { honeypot } from './utils/honeypot.server.ts'
import { combineHeaders, getDomainUrl, getPodcastImgSrc } from './utils/misc.tsx'
import { useNonce } from './utils/nonce-provider.ts'
import { type Theme, getTheme } from './utils/theme.server.ts'
import { makeTimings, time } from './utils/timing.server.ts'
import { getToast } from './utils/toast.server.ts'
import { useOptionalUser } from './utils/user.ts'

export const links: Route.LinksFunction = () => {
	return [
		// Preload svg sprite as a resource to avoid render blocking
		{ rel: 'preload', href: iconsHref, as: 'image' },
		{ rel: 'apple-touch-icon', href: appleTouchIconAssetUrl },
		{
			rel: 'manifest',
			href: '/site.webmanifest',
			crossOrigin: 'use-credentials',
		} as const, // necessary to make typescript happy
		{ rel: 'stylesheet', href: tailwindStyleSheetUrl },
	].filter(Boolean)
}

export const meta: Route.MetaFunction = ({ data }) => {
	return [
		{ title: data ? 'Podcasty' : 'Error | Podcasty' },
		{ name: 'description', content: `Your one stop shop for hosting your own podcast` },
	]
}

export async function loader({ request }: Route.LoaderArgs) {
	const timings = makeTimings('root loader')
	const userId = await time(() => getUserId(request), {
		timings,
		type: 'getUserId',
		desc: 'getUserId in root',
	})

	const user = userId
		? await time(
				() =>
					prisma.user.findUnique({
						select: {
							id: true,
							name: true,
							username: true,
							image: { select: { id: true, objectKey: true } },
							roles: {
								select: {
									name: true,
									permissions: {
										select: { entity: true, action: true, access: true },
									},
								},
							},
						},
						where: { id: userId },
					}),
				{ timings, type: 'find user', desc: 'find user in root' },
			)
		: null
	const podcastCount = await prisma.podcast.count()
	let faviconHref: string | null = null
	if (podcastCount === 1) {
		const singlePodcast = await prisma.podcast.findFirst({
			select: {
				image: { select: { id: true, objectKey: true, updatedAt: true } },
			},
		})
		if (singlePodcast?.image) {
			faviconHref = getPodcastImgSrc(
				singlePodcast.image,
				singlePodcast.image.updatedAt,
			)
		}
	}
	if (userId && !user) {
		console.info('something weird happened')
		// something weird happened... The user is authenticated but we can't find
		// them in the database. Maybe they were deleted? Let's log them out.
		await logout({ request, redirectTo: '/' })
	}
	const { toast, headers: toastHeaders } = await getToast(request)
	const honeyProps = await honeypot.getInputProps()

	// If there are no users at all, send to signup to create the first admin
	const userCount = await prisma.user.count()
	if (!userId && userCount === 0 && new URL(request.url).pathname === '/') {
		throw redirect('/signup')
	}

	return data(
		{
			user,
			requestInfo: {
				hints: getHints(request),
				origin: getDomainUrl(request),
				path: new URL(request.url).pathname,
				userPrefs: {
					theme: getTheme(request),
				},
			},
			isSinglePodcastSite: podcastCount === 1,
			faviconHref,
			ENV: getEnv(),
			toast,
			honeyProps,
		},
		{
			headers: combineHeaders(
				{ 'Server-Timing': timings.toString() },
				toastHeaders,
			),
		},
	)
}

export const headers: Route.HeadersFunction = pipeHeaders

function Document({
	children,
	nonce,
	theme = 'light',
	env = {},
	faviconHref,
}: {
	children: React.ReactNode
	nonce: string
	theme?: Theme
	env?: Record<string, string | undefined>
	faviconHref?: string | null
}) {
	const allowIndexing = ENV.ALLOW_INDEXING !== 'false'
	const colorScheme = theme === 'dark' ? 'dark' : 'light'
	return (
		<html
			lang="en"
			className={`${theme} h-full overflow-x-hidden`}
			data-theme={theme}
			style={{ colorScheme }}
		>
			<head>
				<ClientHintCheck nonce={nonce} />
				<Meta />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<script
					nonce={nonce}
					dangerouslySetInnerHTML={{
						// Sync the initial class to avoid a flash when user/system prefers dark.
						__html: `
;(() => {
	const getCookieTheme = () => {
		const match = document.cookie.match(/(?:^|; )en_theme=([^;]+)/)
		if (!match) return null
		try {
			return decodeURIComponent(match[1])
		} catch {
			return null
		}
	}
	const cookieTheme = getCookieTheme()
	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
	const nextTheme =
		cookieTheme === 'dark'
			? 'dark'
			: cookieTheme === 'light'
				? 'light'
				: prefersDark
					? 'dark'
					: 'light'
	document.documentElement.classList.remove('light', 'dark')
	document.documentElement.classList.add(nextTheme)
	document.documentElement.style.colorScheme = nextTheme
	document.documentElement.dataset.theme = nextTheme
})()
						`.trim(),
					}}
				/>
				{allowIndexing ? null : (
					<meta name="robots" content="noindex, nofollow" />
				)}
				<Links />
				<link
					rel="icon"
					type="image/png"
					sizes="any"
					href={faviconHref ?? faviconAssetUrl ?? '/favicon.ico'}
				/>
			</head>
			<body className="bg-background text-foreground">
				{children}
				<script
					nonce={nonce}
					dangerouslySetInnerHTML={{
						__html: `window.ENV = ${JSON.stringify(env)}`,
					}}
				/>
				<ScrollRestoration nonce={nonce} />
				<Scripts nonce={nonce} />
			</body>
		</html>
	)
}

export function Layout({ children }: { children: React.ReactNode }) {
	// if there was an error running the loader, data could be missing
	const data = useLoaderData<typeof loader | null>()
	const nonce = useNonce()
	const theme = useOptionalTheme()
	return (
		<Document
			nonce={nonce}
			theme={theme}
			env={data?.ENV}
			faviconHref={data?.faviconHref}
		>
			{children}
		</Document>
	)
}

function App() {
	const data = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	const theme = useTheme()
	const matches = useMatches()
	const isOnSearchPage = matches.find(
		(m) => m.id === 'routes/users+/index' || m.id === 'routes/podcasts',
	)
	const isSinglePodcastSite = data.isSinglePodcastSite
	const hideHeader = isSinglePodcastSite && data.requestInfo.path === '/'
	const searchBar =
		isOnSearchPage || isSinglePodcastSite ? null : (
			<SearchBar status="idle" action="/podcasts" placeholder="Search podcasts" />
		)
	useToast(data.toast)

	return (
		<>
			<div className="flex min-h-screen flex-col justify-between">
				{hideHeader ? null : (
					<header className="container py-6">
						<nav className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap md:gap-8">
							<Logo />
							<div className="ml-auto hidden max-w-sm flex-1 sm:block">
								{searchBar}
							</div>
							<div className="flex items-center gap-10">
								{user ? <UserDropdown /> : null}
							</div>
							<div className="block w-full sm:hidden">{searchBar}</div>
						</nav>
					</header>
				)}

				<div className="flex-1">
					<Outlet />
				</div>

				<div className="fixed bottom-5 right-5 z-50">
					<ThemeSwitch userPreference={data.requestInfo.userPrefs.theme} />
				</div>
			</div>
			<Toaster closeButton position="top-center" theme={theme} />
			<EpicProgress />
		</>
	)
}

function Logo() {
	return (
		<Link to="/" className="group grid leading-snug">
			<img src={logoIcon} alt="" />
		</Link>
	)
}

function AppWithProviders() {
	const data = useLoaderData<typeof loader>()
	return (
		<HoneypotProvider {...data.honeyProps}>
			<App />
		</HoneypotProvider>
	)
}

export default AppWithProviders

// this is a last resort error boundary. There's not much useful information we
// can offer at this level.
export const ErrorBoundary = GeneralErrorBoundary
