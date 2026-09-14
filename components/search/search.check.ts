// Run: npx tsx components/search/search.check.ts
import assert from 'node:assert/strict'
import { search } from '@/lib/catalog'
import { appliedFilters, displayAmount, parseQuery, priceLabel, priceRanges, toHref } from './params'
import { correctSpelling } from './spelling'

assert.equal(correctSpelling('iphnoe'), 'iphone')
assert.equal(correctSpelling('phone case'), null, 'known words are left alone')
assert.equal(correctSpelling('zzqqxx'), null, 'nothing close stays uncorrected')
assert.ok(search({ q: correctSpelling('lapptop') ?? '' }).total > 0)

const q = parseQuery({ k: ' phone ', i: 'constructor', brand: ['Apple', 'Apple', ' '], min: '80', max: '$20', rating: '9', sort: 'bogus', page: 'x' })
assert.deepEqual([q.k, q.i, q.brand, q.min, q.max, q.rating, q.sort, q.page], ['phone', '', ['Apple'], 20, 80, undefined, 'featured', 1])
assert.equal(parseQuery({ i: 'smartphones', page: '3', min: '-5' }).page, 3)
assert.equal(parseQuery({ min: '-5' }).min, undefined)
assert.equal(toHref({ ...q, page: 3 }, { brand: [] }), '/s?k=phone&min=20&max=80', 'filter change resets page')
assert.equal(toHref(q, { page: 2, sort: 'price-asc' }), '/s?k=phone&brand=Apple&min=20&max=80&sort=price-asc&page=2')
assert.deepEqual(appliedFilters(q).map((c) => c.label), ['Apple', '$20 to $80'])
assert.equal(toHref(parseQuery({})), '/s')

// PKR: bands and typed amounts are rupees, the URL keeps 4-decimal dollars that read back as the same rupees
const pk = parseQuery({ min: '5000', max: '15000', cur: 'PKR' })
assert.deepEqual([pk.min, pk.max], [18.046, 54.1379])
assert.deepEqual(priceRanges('PKR')[1], [pk.min, pk.max], 'a typed band matches the band link')
assert.equal(toHref(pk), '/s?min=18.046&max=54.1379', 'cur is not kept')
assert.deepEqual(appliedFilters(pk, 'PKR').map((c) => c.label), ['PKR 5,000 to 15,000'])
assert.equal(priceLabel(undefined, 25, 'PKR'), 'Up to PKR 6,927', 'a dollar link reads in rupees')
assert.equal(priceLabel(60000 / 277.07, undefined, 'PKR'), 'PKR 60,000 & above')
assert.equal(priceLabel(18.046, undefined), '$18.05 & above')
assert.equal(displayAmount(19.99), '$19.99')
assert.equal(parseQuery({ max: '25', cur: 'bogus' }).max, 25)

console.log('search helpers ok')
