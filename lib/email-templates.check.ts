// Run: npx tsx lib/email-templates.check.ts
import assert from 'node:assert/strict'
import { canReceiveEmail } from './email'
import { orderEmail, restockEmail } from './email-templates'
import type { Order, OrderItem } from './orders'
import { IMPORT_FEES_NOTE } from './region'

const item = (productId: number, title: string, priceCents: number, quantity: number, extra: Partial<OrderItem> = {}): OrderItem => ({
  productId, title, thumbnail: `https://cdn.dummyjson.com/${productId}.webp`, priceCents, quantity, returnReason: null, returnedAt: null, cancelledAt: null,
  returnCode: null, returnMethod: null, returnResolution: null, refundCents: null, refundedAt: null, replacementOrderId: null, ...extra,
})
const order: Order = {
  id: '113-1234567-7654321',
  shipTo: { fullName: 'Ada <b>Lovelace</b>', phone: '2065550142', line1: '410 Terry Ave N', line2: '', city: 'Seattle', state: 'WA', zip: '98109', country: 'United States', instructions: '' },
  payment: { brand: 'Visa', last4: '4242', nameOnCard: 'Ada' },
  deliverySpeed: 'standard', itemsCents: 4997, shippingCents: 0, taxCents: 412, dutyCents: 0, totalCents: 5409, currency: 'USD', fxRate: 1,
  placedAt: new Date('2026-09-14T10:00:00Z'), deliverBy: new Date('2026-09-17T20:00:00Z'), cancelledAt: null, replacementFor: null,
  items: [item(1, 'Essence Mascara Lash Princess <script>alert(1)</script>', 999, 2), item(2, 'Red Lipstick', 2999, 1)],
}
const origin = 'https://nile.example'

const conf = orderEmail('confirmation', { order, name: 'Ada <img src=x onerror=alert(1)>', origin })
assert.equal(conf.subject, 'Ordered: "Essence Mascara Lash Princess <script>alert(…" and 1 more item') // plain text, clipped at 45
assert.ok(!conf.html.includes('<script>') && !conf.html.includes('<img src=x'), 'user and catalog text is escaped')
assert.ok(conf.html.includes(`href="${origin}/orders/${order.id}"`), 'links to the order')
assert.ok(conf.html.includes('$54.09') && conf.html.includes('FREE') && conf.html.includes('Thursday, September 17'), 'totals, free shipping and arrival date')
assert.ok(conf.text.includes('Order total: $54.09') && conf.text.includes(`${origin}/orders/${order.id}`))

const three = { ...order, items: [...order.items, item(3, 'Dior J\'adore', 8999, 1)] }
assert.match(orderEmail('confirmation', { order: three, name: 'Ada', origin }).subject, /and 2 more items$/)

const partial = { ...order, items: [item(1, 'Essence Mascara', 999, 2, { cancelledAt: new Date() }), item(2, 'Red Lipstick', 2999, 1)] }
const cancel = orderEmail('cancelled', { order: partial, name: 'Ada', origin, productIds: [1] })
assert.equal(cancel.subject, 'Canceled: "Essence Mascara"')
assert.ok(cancel.html.includes('$21.63') && !cancel.html.includes('Red Lipstick'), 'only the canceled item, with its tax share')
const whole = orderEmail('cancelled', { order: { ...order, cancelledAt: new Date(), items: order.items.map((i) => ({ ...i, cancelledAt: new Date() })) }, name: 'Ada', origin })
assert.equal(whole.subject, `Your nile order #${order.id} has been canceled`)

const returned = { ...order, items: [item(2, 'Red Lipstick', 2999, 1, { returnedAt: new Date('2026-09-20T10:00:00Z'), returnCode: 'RT-ABC234', returnMethod: 'ups-store', returnResolution: 'refund', refundCents: 3246 })] }
const ret = orderEmail('return', { order: returned, name: 'Ada', origin, productIds: [2] })
assert.equal(ret.subject, 'Return started: "Red Lipstick"')
assert.ok(ret.html.includes('RT-ABC234') && ret.html.includes('$32.46') && ret.html.includes(`return?code=RT-ABC234`))

const del = orderEmail('delivered', { order, name: 'Ada', origin })
assert.match(del.subject, /^Delivered: "Essence Mascara/)
assert.ok(del.html.includes('October 17, 2026'), '30-day return date')

// a Pakistan order shown in PKR at the rate it was placed with: flat international shipping, no tax, the import-fees note
const pk: Order = {
  ...order, currency: 'PKR', fxRate: 277.07, shippingCents: 1499, taxCents: 0, totalCents: 6496,
  shipTo: { ...order.shipTo, fullName: 'Ayesha Khan', phone: '0300 1234567', line1: '12 Mall Road', city: 'Lahore', state: 'PB', zip: '54000', country: 'Pakistan' },
}
const pkConf = orderEmail('confirmation', { order: pk, name: 'Ayesha', origin })
for (const s of ['PKR 5,535.86', 'PKR 13,845.19', 'PKR 4,153.28', 'PKR 17,998.47', 'Lahore, Punjab 54000, Pakistan', 'Standard International Delivery', IMPORT_FEES_NOTE]) {
  assert.ok(pkConf.html.includes(s), `PK confirmation html has ${s}`)
}
assert.ok(pkConf.text.includes('Order total: PKR 17,998.47') && pkConf.text.includes(IMPORT_FEES_NOTE))
assert.ok(!pkConf.html.includes('$') && !pkConf.html.includes('tax') && !pkConf.html.includes('FREE'), 'no dollars, tax line or free shipping')
const pkCancel = orderEmail('cancelled', { order: { ...pk, items: partial.items }, name: 'Ayesha', origin, productIds: [1] })
assert.ok(pkCancel.html.includes('PKR 5,535.86') && pkCancel.html.includes(IMPORT_FEES_NOTE), 'PK refunds carry no tax share')
const pkWhole = orderEmail('cancelled', { order: { ...pk, cancelledAt: new Date(), items: pk.items.map((i) => ({ ...i, cancelledAt: new Date() })) }, name: 'Ayesha', origin })
assert.ok(pkWhole.text.includes('Not charged: PKR 17,998.47'), 'whole cancel matches the shown order total')
const pkRet = orderEmail('return', { order: { ...pk, items: returned.items.map((i) => ({ ...i, refundCents: 2999 })) }, name: 'Ayesha', origin, productIds: [2] })
assert.ok(pkRet.text.includes('Estimated refund: PKR 8,309.33') && pkRet.html.includes(IMPORT_FEES_NOTE))
const pkDel = orderEmail('delivered', { order: pk, name: 'Ayesha', origin })
assert.ok(pkDel.html.includes('PKR 8,309.33') && pkDel.html.includes(IMPORT_FEES_NOTE) && !pkDel.html.includes('$'))

// the restock reminder: names the product, offers the reorder and the stop, and promises nothing recurring
const stopUrl = 'https://nile.example/api/reminders/stop?id=8f14e45f-ceea-467a-9a8c-0f1e2d3c4b5a'
const restock = restockEmail({
  product: { id: 31, title: 'Lemon <script>alert(1)</script>', thumbnail: 'https://cdn.dummyjson.com/31.webp' },
  name: 'Ada <img src=x onerror=alert(1)>',
  origin,
  stopUrl,
})
assert.equal(restock.subject, 'Running low on Lemon <script>alert(1)</script>?') // plain text; the html body escapes it
assert.ok(restock.html.includes(stopUrl) && restock.text.includes(stopUrl), 'every send carries the one-click stop')
assert.ok(restock.html.includes(`${origin}/dp/31`), 'buy it again links to the product')
assert.ok(!restock.html.includes('<script>') && !restock.html.includes('<img src=x'), 'product and shopper text is escaped')
assert.ok(restock.html.includes('nothing is subscribed and no card is charged') && restock.text.includes('nothing is subscribed'))

assert.equal(canReceiveEmail('demo-abc@example.com'), false)
assert.equal(canReceiveEmail('qa@mail.test'), false)
assert.equal(canReceiveEmail('someone@gmail.com'), true)
assert.equal(canReceiveEmail('me@example.company.com'), true)

console.log('email templates ok')
