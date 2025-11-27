import { render } from '@react-email/components'
import { type ReactElement } from 'react'
import { z } from 'zod'
import tls from 'node:tls'
import net from 'node:net'

const resendErrorSchema = z.union([
	z.object({
		name: z.string(),
		message: z.string(),
		statusCode: z.number(),
	}),
	z.object({
		name: z.literal('UnknownError'),
		message: z.literal('Unknown Error'),
		statusCode: z.literal(500),
		cause: z.any(),
	}),
])
type ResendError = z.infer<typeof resendErrorSchema>

const resendSuccessSchema = z.object({
	id: z.string(),
})

export async function sendEmail({
	react,
	...options
}: {
	to: string
	subject: string
} & (
	| { html: string; text: string; react?: never }
	| { react: ReactElement; html?: never; text?: never }
)) {
	const from =
		process.env.SMTP_FROM ||
		process.env.RESEND_FROM ||
		'hello@epicstack.dev'

	const email = {
		from,
		...options,
		...(react ? await renderReactEmail(react) : null),
	}

	// If Resend is configured, prefer it.
	if (process.env.RESEND_API_KEY) {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			body: JSON.stringify(email),
			headers: {
				Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
				'Content-Type': 'application/json',
			},
		})
		const data = await response.json()
		const parsedData = resendSuccessSchema.safeParse(data)

		if (response.ok && parsedData.success) {
			return {
				status: 'success',
				data: parsedData,
			} as const
		} else {
			const parseResult = resendErrorSchema.safeParse(data)
			if (parseResult.success) {
				return {
					status: 'error',
					error: parseResult.data,
				} as const
			} else {
				return {
					status: 'error',
					error: {
						name: 'UnknownError',
						message: 'Unknown Error',
						statusCode: 500,
						cause: data,
					} satisfies ResendError,
				} as const
			}
		}
	}

	// Fallback to SMTP if configured
	const smtpConfig = getSmtpConfig()
	if (smtpConfig) {
		await sendViaSmtp({
			config: smtpConfig,
			...email,
		})
		return {
			status: 'success',
			data: { id: 'smtp' },
		} as const
	}

	// Mock if nothing configured and not in mocks
	console.error(
		`No email provider configured (RESEND_API_KEY or SMTP_*). Would have sent:`,
		JSON.stringify(email),
	)
	return {
		status: 'success',
		data: { id: 'mocked' },
	} as const
}

async function renderReactEmail(react: ReactElement) {
	const [html, text] = await Promise.all([
		render(react),
		render(react, { plainText: true }),
	])
	return { html, text }
}

type SmtpConfig = {
	host: string
	port: number
	secure: boolean
	user: string
	pass: string
	from: string
}

function getSmtpConfig(): SmtpConfig | null {
	const host = process.env.SMTP_HOST
	const port = Number(process.env.SMTP_PORT || '465')
	const user = process.env.SMTP_USER
	const pass = process.env.SMTP_PASS
	const from =
		process.env.SMTP_FROM ||
		process.env.RESEND_FROM ||
		'hello@epicstack.dev'
	const secure = process.env.SMTP_SECURE !== 'false'

	if (host && user && pass) {
		return { host, port, user, pass, from, secure }
	}
	return null
}

async function sendViaSmtp({
	config,
	to,
	subject,
	html,
	text,
}: {
	config: SmtpConfig
	to: string
	subject: string
	html?: string
	text?: string
}) {
	const body =
		html ??
		text ??
		'(no body provided)'
	const message = [
		`From: ${config.from}`,
		`To: ${to}`,
		`Subject: ${subject}`,
		'MIME-Version: 1.0',
		html
			? 'Content-Type: text/html; charset=utf-8'
			: 'Content-Type: text/plain; charset=utf-8',
		'',
		body,
	].join('\r\n')

	await smtpSend(config, message, to)
}

function smtpSend(config: SmtpConfig, message: string, to: string) {
	const socket = config.secure
		? tls.connect(config.port, config.host)
		: net.connect(config.port, config.host)

	return new Promise<void>((resolve, reject) => {
		let buffer = ''
		const clean = () => {
			socket.removeAllListeners()
		}

		const readResponse = (): Promise<string> =>
			new Promise((res, rej) => {
				const onData = (data: Buffer) => {
					buffer += data.toString()
					const lines = buffer.split('\r\n')
					for (const line of lines) {
						if (/^\d{3} /.test(line)) {
							buffer = ''
							socket.off('data', onData)
							socket.off('error', onError)
							res(line)
							return
						}
					}
				}
				const onError = (err: Error) => {
					socket.off('data', onData)
					socket.off('error', onError)
					rej(err)
				}
				socket.on('data', onData)
				socket.on('error', onError)
			})

		const send = async (cmd: string, expect: RegExp) => {
			socket.write(cmd + '\r\n')
			const resp = await readResponse()
			if (!expect.test(resp)) {
				throw new Error(`SMTP unexpected response (${cmd}): ${resp}`)
			}
		}

		socket.once('error', (err) => {
			clean()
			reject(err)
		})

		socket.once('close', () => {
			clean()
		})

		// Start sequence
		readResponse()
			.then(() => send(`EHLO localhost`, /^2/))
			.then(() => send(`AUTH LOGIN`, /^3/))
			.then(() => send(Buffer.from(config.user).toString('base64'), /^3/))
			.then(() => send(Buffer.from(config.pass).toString('base64'), /^2/))
			.then(() => send(`MAIL FROM:<${config.from}>`, /^2/))
			.then(() => send(`RCPT TO:<${to}>`, /^2|^3/))
			.then(() => send(`DATA`, /^3/))
			.then(async () => {
				const safeMessage = message.replace(/^\./gm, '..')
				socket.write(safeMessage + '\r\n.\r\n')
				const resp = await readResponse()
				if (!/^2/.test(resp)) {
					throw new Error(`SMTP DATA failed: ${resp}`)
				}
			})
			.then(() => send('QUIT', /^2/))
			.then(() => {
				clean()
				resolve()
			})
			.catch((err) => {
				clean()
				reject(err)
				socket.destroy()
			})
	})
}
