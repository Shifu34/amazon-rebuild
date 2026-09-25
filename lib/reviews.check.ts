// Run: npx tsx lib/reviews.check.ts
import assert from 'node:assert/strict'
import { products } from './catalog'
import { aspectDigest, MIN_MENTIONS, mentionsAspect, pinnedReviews, type ReviewItem, verifiedByDefault } from './reviews'

let n = 0
const review = (rating: number, headline: string, extra: Partial<ReviewItem> = {}): ReviewItem => ({
  id: `r${n++}`,
  author: 'Tester',
  rating,
  headline,
  body: '',
  date: new Date('2026-09-01T00:00:00Z'),
  verified: false,
  helpful: 0,
  fromShopper: true,
  own: false,
  voted: false,
  reported: false,
  ...extra,
})

// an aspect needs MIN_MENTIONS before it earns a bar
const two = [review(5, 'Fast shipping!'), review(4, 'shipping was quick')]
assert.equal(MIN_MENTIONS, 3)
assert.deepEqual(aspectDigest(two), [])
assert.deepEqual(aspectDigest([...two, review(2, 'delivery was late')]), [{ key: 'delivery', mentions: 3, positive: 2 }])

// positive is 4-5 stars; a 3-star mention counts in the total but never as positive, so the bar matches the list
const mixed = [review(5, 'great quality'), review(3, 'quality is ok'), review(1, 'poor quality')]
assert.deepEqual(aspectDigest(mixed), [{ key: 'quality', mentions: 3, positive: 1 }])

// the body counts too, and one review can mention several aspects
const both = [
  review(5, 'Love it', { body: 'the price is fair and it arrived early' }),
  review(4, 'Good value', { body: 'shipping was fast' }),
  review(2, 'Not worth the money', { body: 'delivery took ages' }),
]
assert.deepEqual(aspectDigest(both), [
  { key: 'delivery', mentions: 3, positive: 2 },
  { key: 'value for money', mentions: 3, positive: 2 },
])

// at most six bars, most-mentioned first
const many = Object.entries({
  delivery: 'shipping',
  quality: 'quality',
  'value for money': 'price',
  'as described': 'as described',
  'buy again': 'recommend',
  'fit and size': 'fit',
  battery: 'battery',
}).flatMap(([, word]) => [review(5, word), review(5, word), review(5, word)])
many.push(review(5, 'battery'), review(5, 'battery')) // battery is mentioned most, so it leads
const digest = aspectDigest(many)
assert.equal(digest.length, 6)
assert.equal(digest[0].key, 'battery')
assert.equal(digest[0].mentions, 5)

// the filter behind a bar matches exactly what the bar counted
const delivery = [...two, review(2, 'delivery was late')]
assert.equal(delivery.filter((r) => mentionsAspect(r, 'delivery')).length, 3)
assert.equal(mentionsAspect(review(5, 'Great product!'), 'delivery'), false)
assert.equal(mentionsAspect(review(5, 'shipping'), 'nonsense'), false) // unknown keys never filter

// the pinned pair: most helpful praise and most helpful complaint, by votes
const votes = [
  review(5, 'good', { helpful: 2 }),
  review(5, 'better', { helpful: 9 }),
  review(1, 'bad', { helpful: 4 }),
  review(2, 'worse', { helpful: 7 }),
  review(3, 'middling', { helpful: 99 }), // 3 stars is neither
]
const pinned = pinnedReviews(votes)
assert.equal(pinned.positive?.headline, 'better')
assert.equal(pinned.critical?.headline, 'worse')
assert.deepEqual(pinnedReviews([review(3, 'only mixed')]), { positive: undefined, critical: undefined })

// verified-only defaults on only once it would leave reviews behind
const verified = (count: number) => Array.from({ length: count }, () => review(5, 'ok', { verified: true }))
assert.equal(verifiedByDefault([...verified(2), review(5, 'seed')]), false)
assert.equal(verifiedByDefault([...verified(3), review(5, 'seed')]), true)
// ...and never over the viewer's own review, which they must always find on the page
assert.equal(verifiedByDefault([...verified(5), review(4, 'mine', { own: true })]), false)
assert.equal(verifiedByDefault([...verified(5), review(4, 'mine', { own: true, verified: true })]), true)

// the real catalog: the corpus in lib/review-seed.ts has to give almost every product something to summarise,
// or the digest is a feature nothing can reach
const asItems = (p: (typeof products)[number]) =>
  p.reviews.map((r, i) => review(r.rating, r.comment, { id: `seed-${p.id}-${i}`, body: r.body, verified: r.verified }))
const withBars = products.filter((p) => aspectDigest(asItems(p)).length >= 2)
assert.ok(withBars.length / products.length > 0.95, `${withBars.length} of ${products.length} products show two or more aspect bars`)
assert.ok(products.every((p) => aspectDigest(asItems(p)).length >= 1), 'every product summarises at least one aspect')
assert.ok(products.filter((p) => verifiedByDefault(asItems(p))).length > 180, 'verified-only is the default almost everywhere')

console.log('reviews ok')
