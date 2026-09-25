import { getProduct } from '@/lib/catalog'
import { stopByToken } from '@/lib/reminders'

// The email's one-click stop. The row id is the token, so it works without signing in — the worst a stray link
// prefetch can do is cancel a nudge the shopper can set again from Your Account.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? ''
  const stopped = /^[0-9a-f-]{36}$/i.test(id) ? await stopByToken(id) : null
  const title = stopped && getProduct(stopped.product_id)?.title
  return Response.redirect(new URL(`/account?reminder=${stopped ? 'stopped' : 'gone'}${title ? `&title=${encodeURIComponent(title)}` : ''}`, request.url), 303)
}
