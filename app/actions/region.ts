'use server'

import { refresh } from 'next/cache'
import { cookies } from 'next/headers'
import { isCountryCode, isCurrencyCode } from '@/lib/region'

// preferences, not secrets: readable by the page, kept for a year
const YEAR = { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' } as const

// EN menu. Field `currency`: USD | PKR
export async function setCurrency(form: FormData) {
  const currency = form.get('currency')
  if (!isCurrencyCode(currency)) return
  ;(await cookies()).set('currency', currency, YEAR)
  refresh()
}

// Guest location dialog. Field `country`: US | PK, kept as the choice (so a US pick beats a Pakistan IP), and for US an
// optional 5-digit `zip` field saved as the ZIP cookie.
export async function setShipCountry(form: FormData) {
  const country = form.get('country')
  if (!isCountryCode(country)) return
  const jar = await cookies()
  jar.set('ship_country', country, YEAR)
  const zip = String(form.get('zip') ?? '').trim()
  if (country === 'US' && /^\d{5}$/.test(zip)) jar.set('zip', zip, YEAR)
  refresh()
}
