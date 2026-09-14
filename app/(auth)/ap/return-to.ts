import { headers } from 'next/headers'
import { safeReturnTo } from '@/lib/auth'

// ?return_to wins. Without it, go back to the same-site page the shopper came from, so the header and drawer
// "Sign in" links (which don't know the current page) still drop the shopper back where they were.
export async function resolveReturnTo(param: string | string[] | undefined) {
  if (param !== undefined) return safeReturnTo(param)
  const h = await headers()
  const from = URL.parse(h.get('referer') ?? '')
  return from && from.host === h.get('host') && !from.pathname.startsWith('/ap/') ? safeReturnTo(from.pathname + from.search) : '/'
}
