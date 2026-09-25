'use server'

import { refresh } from 'next/cache'
import { cookies } from 'next/headers'

// a preference, not a secret: readable by the page, kept for a year (same shape as app/actions/region.ts)
const YEAR = { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' } as const

// Data saver: most of our shoppers are on metered mobile data, so pictures go through Next's optimiser at a lower quality
// and the heavy grids stop prefetching. Read on the server, so the light page is what gets sent, with no swap after paint.
export async function dataSaver() {
  return (await cookies()).get('data_saver')?.value === '1'
}

// The header switch and the slow-connection prompt both post here. Nothing turns it on without the shopper asking.
export async function setDataSaver(form: FormData) {
  ;(await cookies()).set('data_saver', form.get('on') === '1' ? '1' : '0', YEAR)
  refresh()
}
