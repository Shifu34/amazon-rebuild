// Card number rules, shared by the card form (checked in the browser, so a real card number is never sent) and
// lib/payments.ts (checked again on the server). No server imports here.

export const BRANDS: [string, RegExp][] = [
  ['Visa', /^4/],
  ['Mastercard', /^(5[1-5]|2[2-7])/],
  ['American Express', /^3[47]/],
  ['Discover', /^(6011|65|64[4-9])/],
]

export const cardBrand = (digits: string) => BRANDS.find(([, re]) => re.test(digits))?.[0] ?? null
export const cardDigits = (value: unknown) => String(value ?? '').replace(/[\s-]/g, '')

export function luhn(digits: string) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2
    sum += d
  }
  return sum % 10 === 0
}

// A public demo takes only well-known test numbers, so nobody types in a real card. 4000 0000 0000 0002 declines at checkout.
export const TEST_CARDS = ['4242424242424242', '4000056655665556', '5555555555554444', '378282246310005', '6011111111111117', '4000000000000002']
export const TEST_CARD_ERROR = 'This is a demo store: use a test card such as 4242 4242 4242 4242.'

export function cardNumberError(digits: string) {
  if (!digits) return 'Please enter your card number.'
  if (!/^\d{12,19}$/.test(digits) || !luhn(digits) || !cardBrand(digits)) return 'Please enter a valid card number.'
  return TEST_CARDS.includes(digits) ? null : TEST_CARD_ERROR
}
