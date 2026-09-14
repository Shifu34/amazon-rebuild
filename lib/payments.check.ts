// Run: npx tsx lib/payments.check.ts   (validateCard never touches the database)
import assert from 'node:assert/strict'
import { cardBrand, luhn, TEST_CARD_ERROR, TEST_CARDS } from '@/components/checkout/cards'
import { isExpired, validateCard } from './payments'

const now = new Date('2026-09-14T15:00:00Z')
const card = (fields: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries({ nameOnCard: 'Eve Tester', expMonth: '12', expYear: '2028', cvv: '123', ...fields })) f.set(k, v)
  return validateCard(f, now)
}

// Luhn
for (const n of TEST_CARDS) assert.ok(luhn(n), `${n} passes Luhn`)
assert.ok(luhn('4111111111111111'))
assert.ok(!luhn('4242424242424241'))

// brand detection
assert.equal(cardBrand('4242424242424242'), 'Visa')
assert.equal(cardBrand('5555555555554444'), 'Mastercard')
assert.equal(cardBrand('2221000000000009'), 'Mastercard')
assert.equal(cardBrand('378282246310005'), 'American Express')
assert.equal(cardBrand('6011111111111117'), 'Discover')
assert.equal(cardBrand('9999999999999995'), null)

// allowlist: test cards save (spaces and dashes ignored), everything else is refused, even Luhn-valid real-looking numbers
const ok = card({ number: '4242 4242 4242 4242' })
assert.deepEqual(ok.errors, {})
assert.deepEqual([ok.input.brand, ok.input.last4], ['Visa', '4242'])
assert.equal(card({ number: '4000-0566-5566-5556' }).input.brand, 'Visa')
assert.deepEqual(card({ number: '5555 5555 5555 4444' }).errors, {})
assert.deepEqual(card({ number: '3782 822463 10005', cvv: '1234' }).errors, {})
assert.equal(card({ number: '3782 822463 10005', cvv: '123' }).errors.cvv, 'Security code must be 4 digits.')
assert.deepEqual(card({ number: '6011 1111 1111 1117' }).errors, {})
assert.equal(card({ number: '4000 0000 0000 0002' }).input.last4, '0002')
assert.equal(card({ number: '4111 1111 1111 1111' }).errors.number, TEST_CARD_ERROR)
assert.equal(card({ number: '4242 4242 4242 4241' }).errors.number, 'Please enter a valid card number.')
assert.equal(card({ number: '' }).errors.number, 'Please enter your card number.')

// only brand, last 4, expiry and name come out of validation
assert.deepEqual(Object.keys(ok.input).sort(), ['brand', 'expMonth', 'expYear', 'last4', 'makeDefault', 'nameOnCard'])

// expiry: good through the end of the month
assert.ok(!isExpired({ expMonth: 9, expYear: 2026 }, now))
assert.ok(isExpired({ expMonth: 8, expYear: 2026 }, now))
assert.equal(card({ number: '4242424242424242', expMonth: '8', expYear: '2026' }).errors.exp, "Your card's expiration date is invalid.")

console.log('payments check ok')
