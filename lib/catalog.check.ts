// Run: npx tsx lib/catalog.check.ts
import assert from 'node:assert/strict'
import { bestSellers, boughtTogether, getProduct, products, search, suggest } from './catalog'

assert.equal(products.length, 184)
assert.equal(getProduct(1)?.id, 1)

const iphone = search({ q: 'iphone' })
assert.ok(iphone.total > 0 && iphone.items[0].title.toLowerCase().includes('iphone'), 'title match ranks first')
assert.ok(search({ q: 'phones' }).total > 0, 'plural query matches')
assert.equal(search({ q: 'zzqqxx' }).total, 0)

const sorted = search({ category: 'smartphones', sort: 'price-asc' }).items
assert.ok(sorted.every((p, i) => i === 0 || sorted[i - 1].price <= p.price), 'price sort ascending')

const electronics = ['smartphones', 'laptops', 'tablets', 'mobile-accessories']
assert.ok(search({ category: 'electronics' }).items.every((p) => electronics.includes(p.category)), 'department scope')

const apple = search({ brands: ['Apple'] })
assert.ok(apple.total > 0 && apple.items.every((p) => p.brand === 'Apple'), 'brand filter')
assert.ok(apple.facets.brands.length > 1, 'brand facet ignores its own filter')

const ranged = search({ min: 10, max: 20, perPage: 500 })
assert.ok(ranged.items.every((p) => p.price >= 10 && p.price <= 20), 'price range')
assert.equal(search({ perPage: 24, page: 999 }).page, search({ perPage: 24 }).pages, 'page clamps to last')

// ranking: a category's last word names what it sells, so phones outrank accessories whose category merely says "Phone"
const phoneHits = search({ q: 'phone', perPage: 100 }).items
const phones = products.filter((p) => p.category === 'smartphones').length
assert.ok(phoneHits.slice(0, phones).every((p) => p.category === 'smartphones'), `phones first: ${phoneHits.slice(0, phones + 2).map((p) => p.title)}`)
assert.equal(search({ q: '%' }).total, 0, 'text with no searchable words finds nothing')
assert.equal(search({ q: 'q' }).total, 0, 'a one-letter word only matches a whole word')
assert.ok(products.every((p) => p.badge !== 'best-seller' || p.rating >= 4), 'Best Seller needs 4 stars or more')

// suggestions are query completions, never product titles
assert.ok(suggest('app').terms.length > 0)
const titles = new Set(products.map((p) => p.title.toLowerCase()))
assert.ok(!suggest('iph').terms.some((t) => titles.has(t)), `no titles: ${suggest('iph').terms}`)
assert.ok(suggest('pho').terms.includes('cell phones'), `pho: ${suggest('pho').terms}`)
assert.ok(suggest('apple ph').terms.includes('apple phones'), `apple ph: ${suggest('apple ph').terms}`)
assert.ok(suggest('phone').products.every((p) => p.category === 'smartphones'), 'product rows rank phones first too')
assert.equal(bestSellers(undefined, 5).length, 5)
assert.ok(boughtTogether(getProduct(1)!).every((p) => p.id !== 1))
assert.ok(products.some((p) => p.badge === 'best-seller') && products.some((p) => p.listPrice && p.listPrice > p.price))

console.log('catalog ok')
