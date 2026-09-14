// US delivery addresses: reads, validation (Amazon's field messages) and one-line formatting.
// Writes live in app/actions/addresses.ts. Shared by checkout and the address book.
import { query } from './db'

export type Address = {
  id: string
  fullName: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  zip: string
  country: string
  instructions: string
  isDefault: boolean
}

export const MAX_ADDRESSES = 20

export type AddressInput = Omit<Address, 'id' | 'isDefault' | 'country'> & { makeDefault: boolean }
export type AddressErrors = Partial<Record<'fullName' | 'phone' | 'line1' | 'city' | 'state' | 'zip', string>>

// Valid state codes (50 states + DC; the form's select lists the same codes) mapped to the first digit(s) a ZIP code
// can start with there (USPS national areas), enough to catch a ZIP typed for the wrong state.
// ponytail: first-digit check only, a 3-digit prefix table if false accepts matter
const ZIP_AREA: Record<string, string> = {
  CT: '0', MA: '0', ME: '0', NH: '0', NJ: '0', RI: '0', VT: '0', NY: '01', DE: '1', PA: '1',
  DC: '2', MD: '2', NC: '2', SC: '2', VA: '2', WV: '2', AL: '3', FL: '3', GA: '3', MS: '3', TN: '3',
  IN: '4', KY: '4', MI: '4', OH: '4', IA: '5', MN: '5', MT: '5', ND: '5', SD: '5', WI: '5',
  IL: '6', KS: '6', MO: '6', NE: '6', AR: '7', LA: '7', OK: '7', TX: '78',
  AZ: '8', CO: '8', ID: '8', NM: '8', NV: '8', UT: '8', WY: '8', AK: '9', CA: '9', HI: '9', OR: '9', WA: '9',
}

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

// "123 Main St, Apt 4, Seattle, WA 98101"
export const formatAddress = (a: Pick<Address, 'line1' | 'line2' | 'city' | 'state' | 'zip'>) =>
  [a.line1, a.line2, a.city, `${a.state} ${a.zip}`].filter(Boolean).join(', ')

export function validateAddress(form: FormData): { input: AddressInput; errors: AddressErrors } {
  const text = (name: string, max: number) => String(form.get(name) ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
  const input: AddressInput = {
    fullName: text('fullName', 80),
    phone: text('phone', 30),
    line1: text('line1', 120),
    line2: text('line2', 120),
    city: text('city', 60),
    state: text('state', 2).toUpperCase(),
    zip: text('zip', 10),
    instructions: String(form.get('instructions') ?? '').trim().slice(0, 500),
    makeDefault: form.get('makeDefault') === 'on',
  }
  const errors: AddressErrors = {}
  if (!input.fullName) errors.fullName = 'Please enter a name.'
  const digits = input.phone.replace(/\D/g, '')
  if (!digits) errors.phone = 'Please enter a phone number so we can call if there are any issues with delivery.'
  else if (digits.length < 10 || digits.length > 15 || /[^\d\s()+.-]/.test(input.phone)) errors.phone = 'Please enter a valid phone number.'
  if (!input.line1) errors.line1 = 'Please enter an address.'
  if (!input.city) errors.city = 'Please enter a city name.'
  if (!ZIP_AREA[input.state]) errors.state = 'Please enter a state, region or province.'
  if (!input.zip) errors.zip = 'Please enter a ZIP or postal code.'
  else if (!/^\d{5}(-\d{4})?$/.test(input.zip)) errors.zip = 'Please enter a valid US zip code.'
  else if (ZIP_AREA[input.state] && !ZIP_AREA[input.state].includes(input.zip[0])) errors.zip = "The ZIP code you entered doesn't match the state."
  return { input, errors }
}
