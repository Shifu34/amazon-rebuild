// Saved cards for the demo store. Only brand, last 4, expiry and name are ever stored; the full number and CVV
// are validated and dropped. Writes live in app/actions/payments.ts. Shared by checkout and the wallet.
import { query } from './db'

export type Card = {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  nameOnCard: string
  isDefault: boolean
  expired: boolean
}

export type CardInput = { brand: string; last4: string; expMonth: number; expYear: number; nameOnCard: string; makeDefault: boolean }
export type CardErrors = Partial<Record<'number' | 'nameOnCard' | 'exp' | 'cvv', string>>

// Mock authorization rule, stated on the card form: cards ending in 0002 (Stripe's 4000 0000 0000 0002) decline.
export const DECLINED_LAST4 = '0002'

// the client card form mirrors these prefixes for live brand display (components/card-form.tsx)
const BRANDS: [string, RegExp][] = [
  ['American Express', /^3[47]/],
  ['Visa', /^4/],
  ['Mastercard', /^(5[1-5]|2[2-7])/],
  ['Discover', /^(6011|65|64[4-9])/],
]

export const cardBrand = (digits: string) => BRANDS.find(([, re]) => re.test(digits))?.[0] ?? null

export function luhn(digits: string) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2
    sum += d
  }
  return sum % 10 === 0
}

// a card is good through the last day of its expiry month
export const isExpired = (c: Pick<Card, 'expMonth' | 'expYear'>, now = new Date()) =>
  c.expYear * 12 + c.expMonth < now.getUTCFullYear() * 12 + now.getUTCMonth() + 1

export const cardLabel = (c: Pick<Card, 'brand' | 'last4'>) => `${c.brand} ending in ${c.last4}`
export const cardExpiry = (c: Pick<Card, 'expMonth' | 'expYear'>) => `${String(c.expMonth).padStart(2, '0')}/${c.expYear}`

type Row = { id: string; brand: string; last4: string; exp_month: number; exp_year: number; name_on_card: string; is_default: boolean }

const fromRow = (r: Row): Card => ({
  id: r.id, brand: r.brand, last4: r.last4, expMonth: r.exp_month, expYear: r.exp_year, nameOnCard: r.name_on_card,
  isDefault: r.is_default, expired: isExpired({ expMonth: r.exp_month, expYear: r.exp_year }),
})

export async function getCards(userId: string): Promise<Card[]> {
  const rows = await query<Row>('select * from payment_methods where user_id = $1 order by is_default desc, created_at desc', [userId])
  return rows.map(fromRow)
}

export async function getCard(userId: string, id: string): Promise<Card | null> {
  const [row] = await query<Row>('select * from payment_methods where user_id = $1 and id::text = $2', [userId, id])
  return row ? fromRow(row) : null
}

export function validateCard(form: FormData, now = new Date()): { input: CardInput; errors: CardErrors } {
  const digits = String(form.get('number') ?? '').replace(/[\s-]/g, '')
  const brand = /^\d{12,19}$/.test(digits) && luhn(digits) ? cardBrand(digits) : null
  const expMonth = Number(form.get('expMonth'))
  const expYear = Number(form.get('expYear'))
  const cvv = String(form.get('cvv') ?? '').trim()
  const input: CardInput = {
    brand: brand ?? '',
    last4: digits.slice(-4),
    expMonth,
    expYear,
    nameOnCard: String(form.get('nameOnCard') ?? '').trim().replace(/\s+/g, ' ').slice(0, 80),
    makeDefault: form.get('makeDefault') === 'on',
  }
  const errors: CardErrors = {}
  if (!digits) errors.number = 'Please enter your card number.'
  else if (!brand) errors.number = 'Please enter a valid card number.'
  if (!input.nameOnCard) errors.nameOnCard = 'Please enter the name on your card.'
  const validExp = Number.isInteger(expMonth) && expMonth >= 1 && expMonth <= 12 && Number.isInteger(expYear) && expYear <= now.getUTCFullYear() + 20
  if (!validExp || isExpired(input, now)) errors.exp = "Your card's expiration date is invalid."
  if (!cvv) errors.cvv = "Please enter your card's security code."
  else if (!new RegExp(`^\\d{${brand === 'American Express' ? 4 : 3}}$`).test(cvv)) errors.cvv = `Security code must be ${brand === 'American Express' ? 4 : 3} digits.`
  return { input, errors }
}
