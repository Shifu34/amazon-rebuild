// Run: npx tsx lib/delivery.check.ts
import assert from 'node:assert/strict'
import { deliveryPromise, relativeDay, shipDays } from './delivery'

const day = (d: Date | null) => d?.toISOString().slice(0, 10)
const item = (shipping: string, price = 49.99) => ({ shipping, price })
const MON = '2026-09-14T15:00:00Z'

// ship days
assert.deepEqual(['Ships overnight', 'Ships in 1-2 business days', 'Ships in 1 week', 'Ships in 2 weeks', 'Ships in 1 month', 'Ships soon'].map((s) => shipDays(item(s))), [1, 2, 5, 10, 20, 3])

// §4.4 examples: Monday, September 14, 2026 at 15:00 UTC
for (const [shipping, standard, expedited] of [
  ['Ships overnight', '2026-09-16', '2026-09-15'],
  ['Ships in 1-2 business days', '2026-09-17', '2026-09-15'],
  ['Ships in 1 week', '2026-09-22', '2026-09-17'],
  ['Ships in 2 weeks', '2026-09-29', '2026-09-21'],
  ['Ships in 1 month', '2026-10-13', '2026-09-28'],
]) {
  const p = deliveryPromise(item(shipping), new Date(MON))
  assert.equal(day(p.standard), standard, `${shipping} standard`)
  assert.equal(day(p.expedited), expedited, `${shipping} expedited`)
  assert.equal(day(p.fastest), expedited, 'fastest shows when it beats standard')
}

// cutoff: 22:00 UTC. Before it counting starts today; at or after it, tomorrow
const overnight = item('Ships overnight')
assert.equal(deliveryPromise(overnight, new Date(MON)).within, '7 hrs 0 mins')
assert.equal(deliveryPromise(overnight, new Date('2026-09-14T21:59:30Z')).within, '1 mins')
assert.equal(day(deliveryPromise(overnight, new Date('2026-09-14T21:59:59Z')).standard), '2026-09-16')
assert.equal(day(deliveryPromise(overnight, new Date('2026-09-14T22:00:00Z')).standard), '2026-09-17', 'exactly at the cutoff counts as missed')
const late = deliveryPromise(overnight, new Date('2026-09-14T23:00:00Z'))
assert.equal(day(late.standard), '2026-09-17')
assert.equal(late.within, '23 hrs 0 mins', 'after the cutoff the countdown runs to tomorrow’s')
assert.equal(deliveryPromise(item('Ships in 1 month'), new Date(MON)).within, null, 'no countdown next to a date weeks out')

// weekends are skipped, and a Friday or Saturday cutoff changes nothing, so no countdown then
const fri = deliveryPromise(overnight, new Date('2026-09-18T15:00:00Z'))
assert.deepEqual([day(fri.standard), day(fri.fastest), fri.within], ['2026-09-22', '2026-09-21', null])
const friLate = deliveryPromise(overnight, new Date('2026-09-18T23:00:00Z'))
assert.deepEqual([day(friLate.standard), day(friLate.fastest)], ['2026-09-22', '2026-09-21'])
assert.deepEqual([day(deliveryPromise(overnight, new Date('2026-09-19T10:00:00Z')).standard), deliveryPromise(overnight, new Date('2026-09-19T10:00:00Z')).within], ['2026-09-22', null])
const sun = deliveryPromise(overnight, new Date('2026-09-20T15:00:00Z'))
assert.deepEqual([day(sun.standard), sun.within], ['2026-09-22', '7 hrs 0 mins'], 'Sunday’s cutoff does move the date')
assert.equal(day(deliveryPromise(overnight, new Date('2026-09-20T23:00:00Z')).standard), '2026-09-23')
for (const p of [fri, friLate, sun]) assert.ok(![0, 6].includes(p.standard.getUTCDay()) && ![0, 6].includes(p.expedited.getUTCDay()), 'never arrives on a weekend')

// free-shipping threshold wording (inclusive at $35)
const free = deliveryPromise(item('Ships overnight', 35), new Date(MON))
assert.deepEqual([free.label, free.note], ['FREE delivery', null])
const cheap = deliveryPromise(item('Ships overnight', 34.99), new Date(MON))
assert.equal(cheap.label, '$6.99 delivery')
assert.equal(cheap.note, 'FREE delivery on orders of $35 or more')

// relative labels
assert.equal(relativeDay(new Date('2026-09-15T20:00:00Z'), new Date(MON)), 'Tomorrow')
assert.equal(relativeDay(new Date('2026-09-14T20:00:00Z'), new Date(MON)), 'Today')
assert.equal(relativeDay(new Date('2026-09-16T20:00:00Z'), new Date(MON)), 'Wed, Sep 16')

console.log('delivery ok')
