// Demo shopper end to end in headless Chrome: "Explore with a demo account" on sign-in creates a seeded shopper and lands on
// Your Orders with an order in every state; a second browser on the same network within a minute is asked to wait; the
// Not Yet Shipped and Cancelled tabs; a return starts from the delivered order; list, history, address and card are filled in.
// Run with the app up: node e2e/demo.mjs [baseUrl]   (default http://localhost:3000). A run within a minute of another waits.
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const step = (name) => console.log(`- ${name}`)
const orders = page.getByRole('article', { name: /^Order 113-/ })
const withText = (text) => orders.filter({ has: page.getByText(text, { exact: true }) })
const RETURN_STARTED = page.getByText('Return started', { exact: true })

try {
  step('sign-in offers a demo account and says what it creates')
  await page.goto(`${base}/ap/signin`)
  const demo = page.getByRole('button', { name: 'Explore with a demo account' })
  await page.getByText(/^Creates a fresh sample shopper with orders in every state/).waitFor()

  step('it creates the shopper, signs in and lands on Your Orders')
  const landed = async () => {
    await demo.click()
    return Promise.race([
      page.waitForURL(`${base}/orders`, { timeout: 30_000 }).then(() => true, () => false),
      page.getByRole('alert').filter({ hasText: 'wait a minute' }).waitFor({ timeout: 30_000 }).then(() => false, () => false),
    ])
  }
  if (!(await landed())) {
    console.log('  rate limited by a run in the last minute; waiting 61s')
    await page.waitForTimeout(61_000)
    assert.ok(await landed(), 'demo account after waiting a minute')
  }
  await page.getByText('Hello, Demo').first().waitFor()

  step('another browser on the same network within a minute is asked to wait')
  const other = await browser.newContext()
  const second = await other.newPage()
  await second.goto(`${base}/ap/signin`)
  await second.getByRole('button', { name: 'Explore with a demo account' }).click()
  await second.getByRole('alert').filter({ hasText: 'Please wait a minute and try again.' }).waitFor()
  assert.equal(new URL(second.url()).pathname, '/ap/signin')
  await other.close()

  step('Your Orders has an order in every state')
  await page.getByText('6 orders').waitFor()
  assert.equal(await orders.count(), 6)
  await withText('Not yet shipped').getByRole('link', { name: 'Cancel items' }).waitFor()
  await withText('Shipped').getByRole('link', { name: 'Track package' }).waitFor()
  await withText('Out for delivery').getByRole('heading', { name: /^Now arriving today by \d{1,2} (AM|PM)$/ }).waitFor()
  await withText('You have not been charged for this order.').getByRole('heading', { name: 'Cancelled', exact: true }).waitFor()
  const delivered = withText('Package was left near the front door or porch')
  assert.equal(await delivered.count(), 2, 'two delivered orders')
  assert.equal(await delivered.filter({ has: RETURN_STARTED }).count(), 1, 'one delivered order already has a return started')
  const returnable = delivered.filter({ hasNot: RETURN_STARTED })
  await returnable.getByRole('heading', { name: /^Delivered / }).waitFor()
  await returnable.getByText(/^Return or replace items: Eligible through /).waitFor()
  await returnable.getByRole('link', { name: 'Write a product review' }).waitFor()

  step('Not Yet Shipped and Cancelled tabs')
  await page.goto(`${base}/orders?tab=not-shipped`)
  await page.getByText('1 order not yet shipped').waitFor()
  await page.goto(`${base}/orders?tab=cancelled`)
  await page.getByText('1 cancelled order').waitFor()

  step('start a return from the delivered order')
  await page.goto(`${base}/orders`)
  await returnable.getByRole('link', { name: 'Return or replace items' }).click()
  await page.waitForURL(/\/orders\/113-\d{7}-\d{7}\/return$/)
  await page.getByLabel('Why are you returning this?').selectOption('No longer needed')
  await page.getByRole('button', { name: 'Confirm your return' }).click()
  await page.waitForURL(/\/return\?code=RT-[A-Z0-9]{6}$/)
  await page.getByRole('heading', { name: 'Return started' }).waitFor()
  await page.goto(`${base}/orders`)
  await page.getByText('6 orders').waitFor()
  assert.equal(await delivered.filter({ has: RETURN_STARTED }).count(), 2, 'both delivered orders now show a return')

  step('Shopping List, browsing history, address and card are filled in')
  await page.goto(`${base}/lists`)
  await page.getByText('Default List · 4 items').first().waitFor()
  await page.goto(`${base}/history`)
  await page.locator('main article').nth(4).waitFor()
  await page.goto(`${base}/account/addresses`)
  await page.getByRole('article', { name: 'Default address: Demo Shopper' }).getByText('410 Terry Ave N').waitFor()
  await page.goto(`${base}/account/payments`)
  await page.getByRole('listitem', { name: 'Visa ending in 4242' }).waitFor()

  step('390px: Your Orders fits without horizontal scrolling')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/orders`)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '/orders overflows at 390px')

  console.log('e2e demo ok')
} catch (e) {
  await page.screenshot({ path: 'e2e/demo-failure.png', fullPage: true }).catch(() => {})
  console.error(`failed at ${page.url()} (screenshot: e2e/demo-failure.png)`)
  throw e
} finally {
  await browser.close()
}
