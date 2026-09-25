// Price lock and price protection end to end in headless Chrome: lock a price, watch a demo drop undercut it, pay the
// lower one, then see the difference refunded when the price falls again before delivery.
// Run with the app up: node e2e/price-lock.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const email = `lock-${Date.now()}@example.com`
const password = 'secret123'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
// US dollars wherever this runs from, so the amounts below are the ones on screen
await page.context().addCookies([{ name: 'currency', value: 'USD', url: base }, { name: 'ship_country', value: 'US', url: base }])
const step = (name) => console.log(`- ${name}`)
const dollars = (text) => Number(text.match(/\$([\d,]+\.\d{2})/)[1].replace(/,/g, ''))
// The price this shopper pays, read from the lock control's own copy ("Hold $9.99 while you decide") rather than from a
// styling class: the price block also carries the discount badge, which is not a price.
const offeredPrice = async () => dollars(await page.getByText(/^Hold \$/).textContent())

try {
  step('sign up, then lock the price on a product')
  await page.goto(`${base}/ap/signin?return_to=${encodeURIComponent('/dp/1')}`)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Your name').fill('Lock Tester')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Re-enter password').fill(password)
  await page.getByRole('button', { name: 'Create your nile account' }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  const shelf = await offeredPrice()
  await page.getByRole('button', { name: 'Lock this price for 48 hours' }).click()
  const lockLine = page.getByText(/^Price locked at \$/)
  await lockLine.waitFor()
  assert.equal(dollars(await lockLine.textContent()), shelf, 'the lock holds the price that was on offer')
  await page.getByText(/left\./).waitFor() // the countdown

  step('a demo drop undercuts the lock, and the shopper pays the lower price')
  await page.getByRole('button', { name: 'Demo: drop this price 10%' }).click()
  // the lock line goes once a lower price beats it: the shopper pays the lower one, so there is nothing left to promise
  await lockLine.waitFor({ state: 'detached' })
  const dropped = await offeredPrice()
  assert.ok(dropped < shelf, `dropped ${dropped} is under the shelf price ${shelf}`)

  step('the dropped price follows the product into the cart and checkout')
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
  await page.goto(`${base}/cart`)
  await page.getByText(`Subtotal (1 item): $${dropped.toFixed(2)}`).first().waitFor()
  await page.getByRole('link', { name: 'Proceed to checkout' }).click()
  await page.waitForURL(`${base}/checkout`)
  await page.getByLabel('Full name (First and Last name)').fill('Lock Tester')
  await page.getByLabel('Phone number').fill('(206) 555-0100')
  await page.getByLabel('Address', { exact: true }).fill('410 Terry Ave N')
  await page.getByLabel('City').fill('Seattle')
  await page.getByLabel('Country/Region').selectOption('US')
  await page.getByLabel('State', { exact: true }).selectOption('WA')
  await page.getByLabel('ZIP Code').fill('98109')
  await page.getByRole('button', { name: 'Use this address' }).click()
  await page.getByRole('heading', { name: 'Delivering to Lock Tester' }).waitFor()
  await page.getByRole('button', { name: 'Use test card' }).click()
  await page.getByRole('button', { name: 'Add your card' }).click()
  await page.getByRole('heading', { name: 'Paying with Visa ending in 4242' }).waitFor()
  const summary = page.getByRole('complementary', { name: 'Order summary' })
  const items = () => summary.locator('dl > div').filter({ hasText: 'Items (1):' }).locator('dd').textContent()
  assert.equal(dollars(await items()), dropped, 'checkout charges the dropped price')

  step('Buy Now quotes the same price it charges')
  await page.goto(`${base}/checkout?buy=1&qty=1`)
  assert.equal(dollars(await items()), dropped, 'Buy Now shows the shopper price, not the shelf price')
  await page.goto(`${base}/checkout`)
  await page.getByRole('heading', { name: 'Paying with Visa ending in 4242' }).waitFor()

  step('place the order; it stores what was charged')
  await page.getByRole('button', { name: 'Place your order' }).first().click()
  await page.waitForURL(/\/thankyou\/113-\d{7}-\d{7}$/)
  const orderId = new URL(page.url()).pathname.split('/').pop()
  await page.getByText(`$${dropped.toFixed(2)}`).first().waitFor()

  step('the price falls again before delivery, so the difference comes back automatically')
  await page.goto(`${base}/dp/1`)
  await page.getByText(/^Hold \$/).waitFor() // the order spent the lock, so the control is back
  await page.getByRole('button', { name: 'Demo: drop this price 10%' }).click()
  await page.waitForFunction((was) => !document.body.innerText.includes(`Hold $${was}`), dropped.toFixed(2))
  const after = await offeredPrice()
  assert.ok(after < dropped, `${after} is under the ${dropped} that was paid`)
  await page.goto(`${base}/orders/${orderId}`)
  await page.getByRole('button', { name: 'Demo: mark as delivered' }).click()
  const orderSummary = page.getByRole('region', { name: 'Order summary' })
  const refundRow = orderSummary.locator('dl > div').filter({ hasText: 'Price protection refund:' }).locator('dd')
  await refundRow.waitFor()
  // the fall comes back with the 8.25% US tax that was charged on it, the same as a cancel or a return
  const fallCents = Math.round((dropped - after) * 100)
  const owed = (fallCents + Math.round(fallCents * 0.0825)) / 100
  assert.equal(dollars(await refundRow.textContent()), owed, 'the refund is the fall plus the tax charged on it')

  console.log('price lock e2e passed')
} catch (e) {
  await page.screenshot({ path: 'e2e/price-lock-failure.png' }).catch(() => {})
  console.error(e)
  process.exitCode = 1
} finally {
  await browser.close()
}
