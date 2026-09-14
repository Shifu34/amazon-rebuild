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

// Guest location dialog. Field `country`: US | PK. US clears the choice (the ZIP cookie and IP fallbacks apply again) and
// saves an optional 5-digit `zip` field as the ZIP cookie.
export async function setShipCountry(form: FormData) {
  const country = form.get('country')
  if (!isCountryCode(country)) return
  const jar = await cookies()
  if (country === 'US') {
    jar.delete('ship_country')
    const zip = String(form.get('zip') ?? '').trim()
    if (/^\d{5}$/.test(zip)) jar.set('zip', zip, YEAR)
  } else {
    jar.set('ship_country', country, YEAR)
  }
  refresh()
}
