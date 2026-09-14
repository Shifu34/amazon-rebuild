// Transactional email over Gmail SMTP. Set GMAIL_USER and GMAIL_APP_PASSWORD (a Google App Password) in Vercel; SMTP_URL
// overrides both (e.g. an Ethereal test inbox). Every attempt is recorded in sent_emails, which also caps sending so a
// public demo can't be used to flood someone's inbox or exhaust the Gmail account's daily quota.
import { headers } from 'next/headers'
import nodemailer, { type Transporter } from 'nodemailer'
import { one, query } from './db'

// reserved domains (RFC 2606 / 6761) never receive mail; demo shoppers and test accounts all use them
const UNDELIVERABLE = /@(?:[^@\s]+\.)?(?:example\.(?:com|net|org)|test|invalid|localhost|local)$/i
const PER_RECIPIENT_PER_DAY = 20
const PER_DAY = 400 // Gmail allows about 500 messages a day per account

let transport: Transporter | null | undefined
function mailer() {
  if (transport !== undefined) return transport
  const { SMTP_URL, GMAIL_USER, GMAIL_APP_PASSWORD } = process.env
  transport = SMTP_URL
    ? nodemailer.createTransport(SMTP_URL)
    : GMAIL_USER && GMAIL_APP_PASSWORD
      ? nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s+/g, '') } })
      : null
  return transport
}

export const canReceiveEmail = (address: string) => !UNDELIVERABLE.test(address.trim())
export const emailConfigured = () => mailer() !== null

export type Email = { to: string; subject: string; html: string; text: string; kind: string; userId?: string; orderId?: string }

// Never throws: a failed email must not undo or fail the order, cancellation or return that triggered it.
export async function sendEmail(e: Email) {
  const to = e.to.trim().toLowerCase()
  const log = (status: 'sent' | 'skipped' | 'failed', note: string | null = null) =>
    query(
      'insert into sent_emails (user_id, to_address, kind, subject, order_id, status, note) values ($1, $2, $3, $4, $5, $6, $7)',
      [e.userId ?? null, to, e.kind, e.subject, e.orderId ?? null, status, note],
    )
  try {
    const m = mailer()
    if (!m) return void (await log('skipped', 'email is not configured'))
    if (!canReceiveEmail(to)) return void (await log('skipped', 'address cannot receive email'))
    const sent = await one<{ recipient: number; total: number }>(
      `select count(*) filter (where to_address = $1)::int as recipient, count(*)::int as total
       from sent_emails where status = 'sent' and created_at > now() - interval '1 day'`,
      [to],
    )
    if ((sent?.recipient ?? 0) >= PER_RECIPIENT_PER_DAY || (sent?.total ?? 0) >= PER_DAY) return void (await log('skipped', 'daily sending limit reached'))
    const info = await m.sendMail({
      from: { name: 'nile', address: process.env.EMAIL_FROM ?? process.env.GMAIL_USER ?? 'orders@nile.test' },
      to,
      subject: e.subject,
      html: e.html,
      text: e.text,
    })
    await log('sent', nodemailer.getTestMessageUrl(info) || null) // a preview link only for test inboxes
  } catch (err) {
    console.error('[email]', e.kind, err)
    await log('failed', String(err instanceof Error ? err.message : err).slice(0, 300)).catch(() => {})
  }
}

// Links in emails point at the production domain when deployed, never at a Host header a request could forge.
export async function siteOrigin() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  const host = (await headers()).get('host') ?? 'localhost:3000'
  return `${/^(localhost|127\.)/.test(host) ? 'http' : 'https'}://${host}`
}
