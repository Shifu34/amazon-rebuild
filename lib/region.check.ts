// Run: npx tsx lib/region.check.ts   (nothing here touches the database)
import assert from 'node:assert/strict'
import { summaryRows } from '@/components/checkout/summary'
import { appliedFilters, displayNumber, parseQuery, toSearch } from '@/components/search/params'
import { formatAddress, validateAddress } from './addresses'
import { deliveryPromise, deliveryText, nextNileDay } from './delivery'
import { getProduct, products, search } from './catalog'
import { itemRefundCents, quote, taxRateFor, trackingEvents, type Order, type OrderLine } from './orders'
import { toCents } from './format'
import { ADVANCE_RATE, advanceCents } from './cod'
import { protectionCents } from './price-lock'
import {
  COUNTRIES, convertCents, countryCodeFromName, CURRENCIES, dutyCentsFor, formatDollars, formatMinor, formatMoney, fromDisplayAmount, IMPORT_FEES_NOTE,
  itemsTotal, lineMinor, minorParts, moneyParts, rateFor, summarize, USD_TO_PKR,
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
assert.equal(formatMinor(2788964, 'PKR'), 'PKR 27,889.64', 'already-converted paisa are not converted again')
assert.equal(formatMinor(-699, 'USD'), '-$6.99')
assert.deepEqual(minorParts(2788964, 'PKR'), { prefix: 'PKR', whole: '27,889', fraction: '64' })

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
  [6999, 1499, 0, 0, 10948, 0, null, IMPORT_FEES_NOTE],
)
// landed cost: both lines are beauty (35%), charged with the order so nothing is collected at the door
assert.deepEqual([pkStd.dutyCents, pkStd.dutyLabel], [2450, 'Import duty (estimated):'])
assert.deepEqual([quote(lines, 'standard', MON, 'US').dutyCents, quote(lines, 'standard', MON, 'US').dutyLabel], [0, null], 'no duty inside the US')
assert.equal(day(pkStd.deliverBy), '2026-10-01', 'slowest item, international')
const pkExp = quote(lines, 'expedited', MON, 'PK')
assert.deepEqual([pkExp.shippingCents, pkExp.taxCents, pkExp.totalCents, day(pkExp.deliverBy)], [2999, 0, 12448, '2026-09-23'])
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
assert.deepEqual(
  [itemRefundCents({ priceCents: 1000, quantity: 2 }), itemRefundCents({ priceCents: 1000, quantity: 2 }, 'PK')],
  [2165, 2000],
  'a US refund returns the tax share; with no order there is no duty share',
)
// a Pakistan refund returns this line's share of the duty the order was charged, and nothing for an older order
assert.equal(itemRefundCents({ priceCents: 1000, quantity: 2 }, 'PK', { dutyCents: 700, itemsCents: 2000 }), 2700)
assert.equal(itemRefundCents({ priceCents: 500, quantity: 1 }, 'PK', { dutyCents: 700, itemsCents: 2000 }), 675)
assert.equal(itemRefundCents({ priceCents: 1000, quantity: 2 }, 'PK', { dutyCents: 0, itemsCents: 2000 }), 2000)

// your nile day: the delivery waits for that weekday and the shipping it saves comes off, tax included
const TUE = new Date('2026-09-22T20:00:00Z') // what usStd promises, a Tuesday
assert.equal(day(nextNileDay(5, TUE)), '2026-09-25', 'Friday after a Tuesday promise')
assert.equal(day(nextNileDay(2, TUE)), '2026-09-22', 'the promise already lands on the chosen day')
const under35: OrderLine[] = [lines[1]] // $9.99, so standard shipping is charged and there is a saving to hand back
const pooled = quote(under35, 'standard', MON, 'US', 5)
assert.deepEqual(
  [pooled.pooled, pooled.creditCents, pooled.beforeTaxCents, pooled.taxCents, pooled.totalCents, day(pooled.deliverBy)],
  [true, 699, 999, 82, 1081, '2026-09-25'],
  'the $6.99 shipping comes back and tax follows it down',
)
const sameDay = quote(under35, 'standard', MON, 'US', 2)
assert.deepEqual([sameDay.pooled, sameDay.creditCents, day(sameDay.deliverBy)], [false, 0, '2026-09-22'], 'no wait, no credit')
assert.equal(quote(under35, 'standard', MON, 'US', 5).deliverBy > quote(under35, 'standard', MON, 'US').deliverBy, true, 'pooling only ever waits')
assert.equal(quote(lines, 'expedited', MON, 'US', 5).pooled, false, 'expedited is never pooled')
const pkPooled = quote(lines, 'standard', MON, 'PK', 5) // Pakistan shipping is never free, so the whole $14.99 comes back
assert.deepEqual([pkPooled.creditCents, pkPooled.totalCents, day(pkPooled.deliverBy)], [1499, 9449, '2026-10-02'])
const overFree = quote(lines, 'standard', MON, 'US', 5) // already FREE over $35: nothing to hand back
assert.deepEqual([overFree.pooled, overFree.creditCents], [true, 0])
// the credit row is a negative line, so the column still adds up in rupees
const pooledRows = summaryRows({ items: [{ priceCents: 999, quantity: 1 }], shippingCents: 699, freeShippingCents: 0, creditCents: 699, taxCents: null }, 'PKR')
assert.deepEqual(pooledRows.rows.map((r) => r.label), ['Items (1):', 'Shipping & handling:', 'Nile day credit:'])
assert.equal(pooledRows.rows[2].text, `-${pooledRows.rows[1].text}`, 'the credit cancels the shipping it saved')

// tracking: Pakistan orders read as an international trip to "City, Pakistan"; US orders keep "City, ST"
const shipped = (country: string, state: string): Order => ({
  id: '113-1234567-1234567', currency: 'USD', fxRate: 1, deliverySpeed: 'standard', itemsCents: 0, shippingCents: 0, taxCents: 0, dutyCents: 0,
  paymentKind: 'card', confirmedAt: null, refusedAt: null, pooled: false, creditCents: 0, totalCents: 0,
  shipTo: { fullName: 'A', phone: '', line1: '', line2: '', city: 'Lahore', state, zip: '54000', country, instructions: '' },
  payment: { brand: 'Visa', last4: '4242', nameOnCard: 'A' }, placedAt: new Date(MON.getTime() - 20 * 86_400_000), deliverBy: new Date(MON.getTime() - 86_400_000),
  cancelledAt: null, replacementFor: null, items: [],
})
const pkScans = trackingEvents(shipped('Pakistan', 'PB'), MON)
assert.deepEqual([pkScans[0].place, pkScans.map((e) => e.label).includes('Departed the US for Pakistan')], ['Lahore, Pakistan', true])
assert.equal(pkScans.find((e) => e.label.startsWith('Cleared customs'))?.place, 'Lahore, Pakistan')
const usScans = trackingEvents(shipped('United States', 'WA'), MON)
assert.deepEqual([usScans[0].place, usScans.map((e) => e.label).includes('Shipped')], ['Lahore, WA', true])

// line items add up in PKR: unit prices shown × quantities are the Items row (cart, checkout, invoice, emails) and refunds
const lemon = { priceCents: 79, quantity: 2 } // Lemon, PKR 218.89 each
assert.equal(formatMinor(itemsTotal([lemon], 'PKR').minor, 'PKR'), 'PKR 437.78', '2 × 218.89, not $1.58 converted (437.77)')
assert.deepEqual(itemsTotal([lemon, { priceCents: 99, quantity: 1 }], 'USD'), { usdCents: 257, minor: 257 })
const rolex = { priceCents: 1599999, quantity: 30 } // PKR 4,433,117.23 each
assert.equal(formatMinor(itemsTotal([rolex], 'PKR').minor, 'PKR'), 'PKR 132,993,516.90')
const lemonWater = summaryRows({ items: [{ priceCents: 79, quantity: 1 }, { priceCents: 99, quantity: 1 }], shippingCents: 1499, freeShippingCents: 0, taxCents: null }, 'PKR')
assert.deepEqual([lemonWater.rows.map((r) => `${r.label} ${r.text}`), lemonWater.total], [['Items (2): PKR 493.19', 'Shipping & handling: PKR 4,153.28'], 'PKR 4,646.47'])
assert.equal(summarize([{ label: 'items', usdCents: 158, minor: 43778 }], 'PKR').total.text, 'PKR 437.78', 'a part’s minor is used as is')
// an international summary carries its own duty row and drops the tax one
const landed = summaryRows({ items: [{ priceCents: 1000, quantity: 1 }], shippingCents: 1499, freeShippingCents: 0, taxCents: null, dutyCents: 350 }, 'PKR')
assert.deepEqual(landed.rows.map((r) => r.label), ['Items (1):', 'Shipping & handling:', 'Import duty (estimated):'])
assert.equal(landed.rows[2].text, 'PKR 969.75')
assert.equal(landed.note, IMPORT_FEES_NOTE)
// a line's refund: all of it (cancel), less a return fee, or nothing left once the fee took it all
assert.equal(lineMinor(rolex, 47999970, 47999970, 'PKR'), 13299351690)
assert.equal(lineMinor(rolex, 47999970, 47999970 - 699, 'PKR'), 13299351690 - convertCents(699, 'PKR'), 'the fee row is exactly PKR 1,936.72')
assert.equal(lineMinor(lemon, 158, 0, 'PKR'), 0)
const usLemon = itemRefundCents(lemon) // 158 + 13 tax
assert.equal(lineMinor(lemon, usLemon, usLemon, 'PKR'), 43778 + convertCents(13, 'PKR'))
assert.equal(lineMinor(lemon, usLemon, usLemon - 50, 'USD'), usLemon - 50, 'USD is the stored cents')

// typed rupee price filters keep exactly the products whose shown price is inside the bound shown ($9.99 shows PKR 2,767.93)
const typed = parseQuery({ i: 'beauty-personal-care', min: '2767.5', max: '5000', cur: 'PKR' })
assert.deepEqual(appliedFilters(typed, 'PKR').map((c) => c.label), ['Beauty & Personal Care', 'PKR 2,767.50 to 5,000'])
assert.deepEqual([displayNumber(typed.min!, 'PKR'), displayNumber(typed.max!, 'PKR')], [2767.5, 5000], 'the boxes read back as typed')
const shownPaisa = (usd: number) => convertCents(Math.round(usd * 100), 'PKR')
const inStock = products.filter((p) => p.stock > 0)
const filtered = (min?: number, max?: number) => {
  const q = parseQuery({ min: min === undefined ? undefined : String(min), max: max === undefined ? undefined : String(max), cur: 'PKR' })
  const got = search({ ...toSearch(q, '', 'PKR'), perPage: 1 }).total
  const want = inStock.filter((p) => (min === undefined || shownPaisa(p.price) >= Math.round(min * 100)) && (max === undefined || shownPaisa(p.price) <= Math.round(max * 100))).length
  assert.equal(got, want, `PKR ${min} to ${max}: ${got} results, ${want} shown inside`)
}
for (const paisa of new Set(inStock.map((p) => shownPaisa(p.price)))) {
  const pkr = paisa / 100
  filtered(pkr, pkr) // a bound equal to the shown price keeps it
  filtered(undefined, Math.round(paisa - 1) / 100) // a paisa under excludes it
  filtered(Math.round(paisa + 1) / 100)
  filtered(Math.round(paisa - 50) / 100, Math.round(paisa + 49.5) / 100) // half-rupee decimals
}

// price lock and price protection: the shopper pays the lowest of shelf, demo drop and locked price, and gets the
// difference back if it falls before delivery (lib/price-lock.ts)
const shelf = toCents(getProduct(1)!.price)
const mine = (o: { lock?: number; drop?: number }): number => Math.min(...[shelf, o.drop, o.lock].filter((c): c is number => typeof c === 'number' && c > 0))
assert.equal(mine({ lock: shelf + 500 }), shelf, 'a lock above the shelf price never charges more')
assert.equal(mine({ lock: shelf - 300 }), shelf - 300, 'a lock under the shelf price wins')
assert.equal(mine({ lock: shelf - 100, drop: shelf - 400 }), shelf - 400, 'a bigger demo drop beats the lock')
// an expired or spent lock is not in the map at all, so the shopper is back to the shelf price
assert.equal(mine({}), shelf)
assert.equal(protectionCents(1000, 2, 900), 200, 'both units are protected')
assert.equal(protectionCents(1000, 1, 1000), 0, 'no refund when the price held')
assert.equal(protectionCents(1000, 3, 1200), 0, 'a rise is never charged after the fact')
// the charged price carries the duty and the order total with it
const locked = { ...getProduct(1)!, price: (shelf - 400) / 100 }
const lockedQuote = quote([{ product: locked, quantity: 1, requested: 1 }], 'standard', MON, 'PK')
assert.equal(lockedQuote.itemsCents, shelf - 400)
assert.equal(lockedQuote.dutyCents, dutyCentsFor('PK', locked.category, shelf - 400), 'duty follows the price actually charged')
assert.equal(lockedQuote.totalCents, lockedQuote.itemsCents + lockedQuote.shippingCents + lockedQuote.dutyCents)

// cash on delivery: nothing up front in good standing, 30% after a refused parcel, and the same amount in rupees
assert.equal(advanceCents(10_000, 0), 0, 'good standing pays nothing up front')
assert.equal(advanceCents(10_000, ADVANCE_RATE), 3000)
assert.equal(advanceCents(8499, ADVANCE_RATE), 2550, 'rounded to the cent, not floored')
assert.equal(formatMoney(advanceCents(8499, ADVANCE_RATE), 'PKR'), 'PKR 7,065.29', 'the advance converts like every other amount')
assert.equal(advanceCents(8499, ADVANCE_RATE) + (8499 - advanceCents(8499, ADVANCE_RATE)), 8499, 'advance plus cash due is the whole order')

console.log('region ok')
