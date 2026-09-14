// Delivery addresses (United States and Pakistan): reads, validation (Amazon's field messages) and one-line formatting.
// Writes live in app/actions/addresses.ts. Shared by checkout and the address book. Countries and regions: lib/region.ts
import { query } from './db'
import { COUNTRIES, countryCodeFromName } from './region'

export type Address = {
  id: string
  fullName: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string // US state or Pakistan ISO 3166-2 region code
  zip: string
  country: string // country name: 'United States' | 'Pakistan'
  instructions: string
  isDefault: boolean
}

export const MAX_ADDRESSES = 20

export type AddressInput = Omit<Address, 'id' | 'isDefault'> & { makeDefault: boolean }
export type AddressErrors = Partial<Record<'fullName' | 'phone' | 'line1' | 'city' | 'state' | 'zip', string>>

type Row = { id: string; full_name: string; phone: string; line1: string; line2: string; city: string; state: string; zip: string; country: string; instructions: string; is_default: boolean }

const fromRow = (r: Row): Address => ({
  id: r.id, fullName: r.full_name, phone: r.phone, line1: r.line1, line2: r.line2, city: r.city,
  state: r.state, zip: r.zip, country: r.country, instructions: r.instructions, isDefault: r.is_default,
})

// default first, then newest
export async function getAddresses(userId: string): Promise<Address[]> {
  const rows = await query<Row>('select * from addresses where user_id = $1 order by is_default desc, created_at desc', [userId])
  return rows.map(fromRow)
}

export async function getAddress(userId: string, id: string): Promise<Address | null> {
  const [row] = await query<Row>('select * from addresses where user_id = $1 and id::text = $2', [userId, id])
  return row ? fromRow(row) : null
}

// "123 Main St, Apt 4, Seattle, WA 98101" | "12 Mall Road, Lahore, Punjab 54000" (Pakistan spells the province out)
export function formatAddress(a: Pick<Address, 'line1' | 'line2' | 'city' | 'state' | 'zip'> & { country?: string }) {
  const code = countryCodeFromName(a.country)
  const state = code === 'PK' ? (COUNTRIES.PK.regions.find((r) => r.code === a.state)?.name ?? a.state) : a.state
  return [a.line1, a.line2, a.city, `${state} ${a.zip}`].filter(Boolean).join(', ')
}

// Pakistan: mobile 03XXXXXXXXX, 3XXXXXXXXX or +92 3XXXXXXXXX; landline 0 or +92, area code and number (042-XXXXXXX),
// 9-10 digits after the 0 or +92. Spaces and dashes are removed first.
const PK_PHONE = /^(?:(?:\+92|0)?3\d{9}|(?:\+92|0)[124-9]\d{8,9})$/

// `country` is US | PK (the country name is accepted too; anything else is treated as US)
export function validateAddress(form: FormData): { input: AddressInput; errors: AddressErrors } {
  const text = (name: string, max: number) => String(form.get(name) ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
  const country = COUNTRIES[countryCodeFromName(text('country', 40))]
  const input: AddressInput = {
    fullName: text('fullName', 80),
    phone: text('phone', 30),
    line1: text('line1', 120),
    line2: text('line2', 120),
    city: text('city', 60),
    state: text('state', 2).toUpperCase(),
    zip: text('zip', 10),
    country: country.name,
    instructions: String(form.get('instructions') ?? '').trim().slice(0, 500),
    makeDefault: form.get('makeDefault') === 'on',
  }
  const pk = country.code === 'PK'
  const errors: AddressErrors = {}
  if (!input.fullName) errors.fullName = 'Please enter a name.'
  const digits = input.phone.replace(/\D/g, '')
  if (!digits) errors.phone = 'Please enter a phone number so we can call if there are any issues with delivery.'
  else if (pk ? !PK_PHONE.test(input.phone.replace(/[\s-]/g, '')) : digits.length < 10 || digits.length > 15 || /[^\d\s()+.-]/.test(input.phone))
    errors.phone = 'Please enter a valid phone number.'
  if (!input.line1) errors.line1 = 'Please enter an address.'
  if (!input.city) errors.city = 'Please enter a city name.'
  const region = country.regions.find((r) => r.code === input.state)
  if (!region) errors.state = 'Please enter a state, region or province.'
  if (!input.zip) errors.zip = 'Please enter a ZIP or postal code.'
  else if (pk) {
    if (!/^\d{5}$/.test(input.zip)) errors.zip = 'Please enter a valid postal code.'
  } else if (!/^\d{5}(-\d{4})?$/.test(input.zip)) errors.zip = 'Please enter a valid US zip code.'
  else if (region?.zip && !region.zip.includes(input.zip[0])) errors.zip = "The ZIP code you entered doesn't match the state."
  return { input, errors }
}
