// Run: npx tsx lib/catalog.check.ts
import assert from 'node:assert/strict'
import { bestSellers, boughtTogether, getProduct, products, search, suggest } from './catalog'
import { seedReviews } from './review-seed'

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

// Seeded reviews (lib/review-seed.ts): stable text, stars that agree with the product's average, and dates in the past.
const seedable = (p: (typeof products)[number]) => ({ id: p.id, category: p.category, rating: p.rating, ratingCount: p.ratingCount, boughtPastMonth: p.boughtPastMonth })
const twice = products.slice(0, 5).map(seedable)
assert.deepEqual(twice.map(seedReviews), twice.map(seedReviews), 'same product, same reviews on every render')
assert.ok(products.every((p) => p.reviews.length >= 6 && p.reviews.length <= 23), 'every product carries a readable number of reviews')
assert.ok(products.every((p) => p.reviews.slice(0, 3).every((r) => r.body === '')), "DummyJSON's own three one-liners are kept as they were")
const now = Date.now()
assert.ok(products.every((p) => p.reviews.every((r) => new Date(r.date).getTime() <= now)), 'no review is dated in the future')
for (const p of products) {
  const written = p.reviews.slice(3)
  const mean = written.reduce((sum, r) => sum + r.rating, 0) / written.length
  assert.ok(Math.abs(mean - p.rating) <= 0.2, `${p.title}: reviews average ${mean.toFixed(2)} but the product shows ${p.rating}`)
  assert.ok(written.every((r) => r.body.length > 20 && r.comment.length > 3), `${p.title}: every review has a headline and a body`)
}
const written = products.flatMap((p) => p.reviews.slice(3))
const share = written.filter((r) => r.verified).length / written.length
assert.ok(share > 0.6 && share < 0.8, `verified purchases are the majority but not all of them: ${(share * 100).toFixed(0)}%`)

console.log('catalog ok')
