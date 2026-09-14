// Run: npx tsx lib/region.check.ts   (nothing here touches the database)
import assert from 'node:assert/strict'
import { formatAddress, validateAddress } from './addresses'
import { deliveryPromise, deliveryText } from './delivery'
import { getProduct } from './catalog'
import { itemRefundCents, quote, taxRateFor, type OrderLine } from './orders'
import {
  COUNTRIES, convertCents, countryCodeFromName, CURRENCIES, formatDollars, formatMoney, fromDisplayAmount, IMPORT_FEES_NOTE, moneyParts,
  rateFor, summarize, USD_TO_PKR,
} from './region'

// rates and conversion
assert.equal(USD_TO_PKR, 277.07)
assert.equal(rateFor('USD'), 1)
assert.equal(rateFor('PKR'), 277.07)
assert.deepEqual([CURRENCIES.PKR.label, CURRENCIES.PKR.prefix, CURRENCIES.USD.prefix], ['Pakistani Rupee', 'PKR', '$'])
assert.equal(convertCents(10000, 'USD'), 10000)
assert.equal(convertCents(10000, 'USD', 277.07), 10000, 'USD ignores a stray rate')
assert.equal(convertCents(10000, 'PKR'), 2770700)
assert.equal(convertCents(50, 'PKR'), 13854, '13853.5 rounds up despite float noise')
assert.equal(convertCents(-50, 'PKR'), -13854, 'negatives round away from zero too')
assert.equal(convertCents(2999, 'PKR'), 830933)
assert.equal(convertCents(1000, 'PKR', 280), 280000, 'an order’s stored rate wins')

// formatting
assert.equal(formatMoney(123456, 'USD'), '$1,234.56')
assert.equal(formatMoney(5, 'USD'), '$0.05')
assert.equal(formatMoney(-699, 'USD'), '-$6.99')
assert.equal(formatMoney(123456, 'PKR'), 'PKR 342,059.54') // 34,205,953.92 paisa
assert.equal(formatMoney(10066, 'PKR'), 'PKR 27,889.87')
assert.equal(formatMoney(0, 'PKR'), 'PKR 0.00')
assert.equal(formatMoney(-699, 'PKR'), '-PKR 1,936.72')
assert.equal(formatDollars(100.66, 'PKR'), 'PKR 27,889.87')
assert.equal(formatDollars(19.99), '$19.99')
assert.equal(formatDollars(1234.5, 'USD'), (1234.5).toLocaleString('en-US', { style: 'currency', currency: 'USD' }), 'same as the old usd()')
assert.deepEqual(moneyParts(10066, 'PKR'), { prefix: 'PKR', whole: '27,889', fraction: '87' })
assert.deepEqual(moneyParts(123456), { prefix: '$', whole: '1,234', fraction: '56' })

// summaries add up in the shown currency
const parts = [
  { label: 'Items:', usdCents: 4997 },
  { label: 'Shipping & handling:', usdCents: 699 },
  { label: 'Free Shipping:', usdCents: -699 },
  { label: 'Tax:', usdCents: 412 },
]
const us = summarize(parts, 'USD')
assert.deepEqual([us.total.minor, us.total.usdCents, us.total.text], [5409, 5409, '$54.09'])
const pk = summarize(parts, 'PKR')
assert.equal(pk.total.minor, pk.rows.reduce((n, r) => n + r.minor, 0))
assert.equal(pk.total.usdCents, 5409)
assert.deepEqual(pk.rows.map((r) => r.text), ['PKR 13,845.19', 'PKR 1,936.72', '-PKR 1,936.72', 'PKR 1,141.53'])
assert.equal(pk.total.text, 'PKR 14,986.72')
assert.equal(summarize([{ label: 'a', usdCents: 1, bold: true }], 'USD').rows[0].bold, true, 'extra fields are kept')
// 3 × 50 cents: converting the sum would give 41,561 paisa; the rows sum to 41,562
assert.equal(summarize([1, 2, 3].map((n) => ({ label: `x${n}`, usdCents: 50 })), 'PKR').total.minor, 41562)

// price filter inputs
assert.equal(fromDisplayAmount(50, 'USD'), 50)
assert.ok(Math.abs(fromDisplayAmount(27707, 'PKR') - 100) < 1e-9)

// countries
assert.equal(countryCodeFromName('Pakistan'), 'PK')
assert.equal(countryCodeFromName('pk'), 'PK')
assert.equal(countryCodeFromName('United States'), 'US')
assert.equal(countryCodeFromName(undefined), 'US')
assert.equal(countryCodeFromName('Atlantis'), 'US')
assert.equal(COUNTRIES.US.regions.length, 51)
assert.deepEqual(COUNTRIES.PK.regions.map((r) => r.code), ['PB', 'SD', 'KP', 'BA', 'IS', 'GB', 'JK'])
assert.deepEqual([COUNTRIES.PK.regionLabel, COUNTRIES.PK.postalLabel, COUNTRIES.PK.defaultCurrency], ['Province/Territory', 'Postal Code', 'PKR'])

// addresses
const form = (fields: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return validateAddress(f)
}
const PK = { country: 'PK', fullName: 'Ayesha Khan', phone: '0300 1234567', line1: '12 Mall Road', city: 'Lahore', state: 'PB', zip: '54000' }
const US = { country: 'US', fullName: 'Eve Tester', phone: '206-555-0142', line1: '410 Terry Ave N', city: 'Seattle', state: 'WA', zip: '98109' }
assert.deepEqual(form(PK).errors, {})
assert.equal(form(PK).input.country, 'Pakistan')
assert.equal(form(US).input.country, 'United States')
assert.deepEqual(form({ ...US, country: 'United States' }).errors, {}, 'the country name still works')
assert.deepEqual(form({ ...US, country: '' }).input.country, 'United States')
for (const phone of ['03001234567', '0300-1234567', '3001234567', '+92 300 1234567', '+923001234567', '042-1234567', '021-34567890', '+92 42 1234567'])
  assert.equal(form({ ...PK, phone }).errors.phone, undefined, `PK phone ${phone}`)
for (const phone of ['12345', '0300123456', '030012345678', '+1 206 555 0142', '(0300) 1234567', '0012345678', '030-1234567'])
  assert.equal(form({ ...PK, phone }).errors.phone, 'Please enter a valid phone number.', `PK phone ${phone} is rejected`)
assert.equal(form({ ...PK, phone: '' }).errors.phone, 'Please enter a phone number so we can call if there are any issues with delivery.')
assert.equal(form({ ...PK, zip: '5400' }).errors.zip, 'Please enter a valid postal code.')
assert.equal(form({ ...PK, zip: '54000-1234' }).errors.zip, 'Please enter a valid postal code.')
assert.equal(form({ ...PK, zip: '' }).errors.zip, 'Please enter a ZIP or postal code.')
assert.equal(form({ ...PK, state: 'WA' }).errors.state, 'Please enter a state, region or province.')
assert.equal(form({ ...US, state: 'PB' }).errors.state, 'Please enter a state, region or province.')
assert.equal(form({ ...PK, state: 'is' }).errors.state, undefined, 'region codes are case-insensitive')
assert.equal(form({ ...US, zip: '10001' }).errors.zip, "The ZIP code you entered doesn't match the state.")
assert.equal(form({ ...US, zip: '9810' }).errors.zip, 'Please enter a valid US zip code.')
assert.equal(form({ ...US, phone: '12345' }).errors.phone, 'Please enter a valid phone number.')
assert.equal(formatAddress({ ...PK, line2: '', country: 'Pakistan' }), '12 Mall Road, Lahore, Punjab 54000')
assert.equal(formatAddress({ ...US, line2: 'Apt 4', country: 'United States' }), '410 Terry Ave N, Apt 4, Seattle, WA 98109')
assert.equal(formatAddress({ ...US, line2: '' }), '410 Terry Ave N, Seattle, WA 98109', 'no country means US')

// delivery: Monday, September 14, 2026 at 15:00 UTC
const MON = new Date('2026-09-14T15:00:00Z')
const day = (d: Date | null) => d?.toISOString().slice(0, 10)
const item = (shipping: string, price = 49.99) => ({ shipping, price })
for (const [shipping, standard, expedited] of [
  ['Ships overnight', '2026-09-25', '2026-09-21'], // 1 + 8 = 9 business days, ceil(1/2) + 4 = 5
  ['Ships in 1-2 business days', '2026-09-28', '2026-09-21'], // 2 + 8 = 10, 1 + 4 = 5
  ['Ships in 1 week', '2026-10-01', '2026-09-23'], // 5 + 8 = 13, 3 + 4 = 7
]) {
  const p = deliveryPromise(item(shipping), MON, 'PK')
  assert.equal(day(p.standard), standard, `PK ${shipping} standard`)
  assert.equal(day(p.expedited), expedited, `PK ${shipping} expedited`)
  assert.equal(p.within, null, 'no countdown for international dates')
}
const pkP = deliveryPromise(item('Ships overnight', 99), MON, 'PK')
assert.deepEqual([pkP.free, pkP.feeUsd, pkP.expeditedFeeUsd, pkP.freeMinUsd], [false, 14.99, 29.99, null], 'never free to Pakistan')
assert.deepEqual(deliveryText(pkP, 'PKR'), { label: 'PKR 4,153.28 delivery', note: null })
assert.deepEqual(deliveryText(pkP, 'USD'), { label: '$14.99 delivery', note: null })
assert.deepEqual([pkP.label, pkP.note], ['$14.99 delivery', null], 'deprecated fields stay in USD')
const usCheap = deliveryPromise(item('Ships overnight', 20), MON)
assert.deepEqual([usCheap.free, usCheap.feeUsd, usCheap.freeMinUsd, day(usCheap.standard)], [false, 6.99, 35, '2026-09-16'], 'US unchanged')
assert.deepEqual(deliveryText(usCheap, 'USD'), { label: '$6.99 delivery', note: 'FREE delivery on orders of $35 or more' })
assert.deepEqual(deliveryText(usCheap, 'PKR'), { label: 'PKR 1,936.72 delivery', note: 'FREE delivery on orders of PKR 9,697.45 or more' })
const usFree = deliveryPromise(item('Ships overnight', 35), MON)
assert.deepEqual([usFree.free, usFree.feeUsd, usFree.label, usFree.note], [true, 0, 'FREE delivery', null])

// quote: Pakistan has flat shipping and no tax; US keeps FREE over $35 and 8.25%
const lines: OrderLine[] = [
  { product: { ...getProduct(1)!, price: 30, shipping: 'Ships overnight' }, quantity: 2, requested: 2 },
  { product: { ...getProduct(2)!, price: 9.99, shipping: 'Ships in 1 week' }, quantity: 1, requested: 1 },
]
const pkStd = quote(lines, 'standard', MON, 'PK')
assert.deepEqual(
  [pkStd.itemsCents, pkStd.shippingCents, pkStd.freeShippingCents, pkStd.taxCents, pkStd.totalCents, pkStd.taxRate, pkStd.taxLabel, pkStd.importNote],
  [6999, 1499, 0, 0, 8498, 0, null, IMPORT_FEES_NOTE],
)
assert.equal(day(pkStd.deliverBy), '2026-10-01', 'slowest item, international')
const pkExp = quote(lines, 'expedited', MON, 'PK')
assert.deepEqual([pkExp.shippingCents, pkExp.taxCents, pkExp.totalCents, day(pkExp.deliverBy)], [2999, 0, 9998, '2026-09-23'])
const usStd = quote(lines, 'standard', MON)
assert.deepEqual(
  [usStd.shippingCents, usStd.freeShippingCents, usStd.taxCents, usStd.totalCents, usStd.country, usStd.taxLabel, usStd.importNote],
  [699, 699, 577, 7576, 'US', 'Estimated tax to be collected:', null],
)
assert.equal(day(usStd.deliverBy), '2026-09-22')
const usExp = quote(lines, 'expedited', MON, 'US')
assert.deepEqual([usExp.shippingCents, usExp.freeShippingCents, usExp.taxCents], [999, 0, Math.round((6999 + 999) * 0.0825)])
assert.equal(quote([lines[1]], 'standard', MON, 'US').freeShippingCents, 0, 'under $35 pays shipping')
assert.deepEqual([taxRateFor('US'), taxRateFor('PK')], [0.0825, 0])
assert.deepEqual([itemRefundCents({ priceCents: 1000, quantity: 2 }), itemRefundCents({ priceCents: 1000, quantity: 2 }, 'PK')], [2165, 2000])

console.log('region ok')
