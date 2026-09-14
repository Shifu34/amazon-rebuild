// The current request's region: delivery country and display currency (rules in docs/region.md).
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { getUser } from './auth'
import { one } from './db'
import { COUNTRIES, countryCodeFromName, isCountryCode, isCurrencyCode, rateFor, type CountryCode, type CurrencyCode } from './region'

export type RequestRegion = {
  currency: CurrencyCode
  country: CountryCode
  countryName: string
  rate: number // display currency per US dollar
  guestCountryChoice: CountryCode | null // the location dialog's pick: ship_country cookie, or 'US' when a ZIP is set
  address: { fullName: string; city: string; zip: string } | null // signed in: the default address the country came from
}

// Country: signed-in shopper's default address → ship_country cookie → US ZIP cookie → x-vercel-ip-country (PK only) → US.
// Currency: currency cookie → the country's default.
export const getRegion = cache(async (): Promise<RequestRegion> => {
  const [jar, h, user] = await Promise.all([cookies(), headers(), getUser()])
  const address = user
    ? await one<{ country: string; full_name: string; city: string; zip: string }>(
        'select country, full_name, city, zip from addresses where user_id = $1 order by is_default desc, created_at desc limit 1',
        [user.id],
      )
    : undefined
  const ship = jar.get('ship_country')?.value
  const guestCountryChoice = isCountryCode(ship) ? ship : /^\d{5}$/.test(jar.get('zip')?.value ?? '') ? 'US' : null
  const country: CountryCode = address
    ? countryCodeFromName(address.country)
    : (guestCountryChoice ?? (h.get('x-vercel-ip-country')?.toUpperCase() === 'PK' ? 'PK' : 'US'))
  const chosen = jar.get('currency')?.value
  const currency = isCurrencyCode(chosen) ? chosen : COUNTRIES[country].defaultCurrency
  return {
    currency, country, countryName: COUNTRIES[country].name, rate: rateFor(currency), guestCountryChoice,
    address: address ? { fullName: address.full_name, city: address.city, zip: address.zip } : null,
  }
})
