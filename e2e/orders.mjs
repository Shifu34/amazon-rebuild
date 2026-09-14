// Your Orders end to end in headless Chrome: sign-in gate, empty states, place an order, Not Yet Shipped, cancel with
// validation, a second order delivered via the demo control, tracking, a return (validation, fee, refund), demo refund,
// Buy it again, Buy Again tab, search, PKR display (orders keep their own currency, summaries add up), another account
// gets a 404, and 390px layouts.
// Run with the app up: node e2e/orders.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const password = 'secret123'
const expYear = String(new Date().getFullYear() + 2)

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const step = (name) => console.log(`- ${name}`)
const waitCart = (n) =>
  page.waitForFunction((n) => document.querySelector('a[aria-label^="Cart, "]')?.getAttribute('aria-label') === `Cart, ${n} ${n === 1 ? 'item' : 'items'}`, n)
const card = (id) => page.getByRole('article', { name: `Order ${id}` })
const setCurrency = (value) => page.context().addCookies([{ name: 'currency', value, url: base }])
// Order Summary rows as { label: text }; money() turns "PKR 1,234.56" / "−$6.99" into minor units
const summaryRows = async () =>
  Object.fromEntries(await page.getByRole('region', { name: 'Order summary' }).locator('dl > div').evaluateAll((divs) => divs.map((d) => [d.querySelector('dt').textContent.trim(), d.querySelector('dd').textContent.trim()])))
const money = (t) => (/^[−-]/.test(t) ? -1 : 1) * Math.round(Number(t.replace(/[^\d.]/g, '')) * 100)

async function register(p, email) {
  await p.getByLabel('Email').fill(email)
  await p.getByRole('button', { name: 'Continue' }).click()
  await p.getByLabel('Your name').fill('Olive Orders')
  await p.getByLabel('Password', { exact: true }).fill(password)
  await p.getByLabel('Re-enter password').fill(password)
  await p.getByRole('button', { name: 'Create your nile account' }).click()
}

async function addToCart(id, count) {
  await page.goto(`${base}/dp/${id}`)
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
  await waitCart(count)
}

async function placeOrder() {
  await page.getByRole('button', { name: 'Place your order' }).first().click()
  await page.waitForURL(/\/thankyou\/113-\d{7}-\d{7}$/)
  return new URL(page.url()).pathname.split('/').pop()
}

try {
  step('signed out: /orders asks to sign in, and return_to keeps tab, range, search and return code queries')
  await page.goto(`${base}/orders`)
  await page.waitForURL(`${base}/ap/signin?return_to=%2Forders`)
  for (const path of ['/orders?tab=not-shipped&range=last30', '/orders?q=lamp', '/orders/113-0000000-0000000/return?code=RT-ABC123']) {
    await page.goto(base + path)
    await page.waitForURL(/\/ap\/signin\?/)
    assert.equal(new URL(page.url()).searchParams.get('return_to'), path, `return_to keeps the query of ${path}`)
  }

  step('create an account from the Cancelled tab and land back on it, on the empty state')
  await page.goto(`${base}/orders?tab=cancelled`)
  await page.waitForURL(`${base}/ap/signin?return_to=%2Forders%3Ftab%3Dcancelled`)
  await register(page, `orders-${Date.now()}@example.com`)
  await page.waitForURL(`${base}/orders?tab=cancelled`)
  await page.getByText('You have not placed any orders yet.').waitFor()
  await page.getByRole('navigation', { name: 'Order views' }).getByRole('link', { name: 'Buy Again' }).click()
  await page.getByText('There are no items to buy again.').waitFor()

  step('place an order with a new address and card')
  await addToCart(4, 1)
  await page.goto(`${base}/checkout`)
  await page.getByLabel('Full name (First and Last name)').fill('Olive Orders')
  await page.getByLabel('Phone number').fill('(206) 555-0100')
  await page.getByLabel('Address', { exact: true }).fill('410 Terry Ave N')
  await page.getByLabel('City').fill('Seattle')
  await page.getByLabel('State', { exact: true }).selectOption('WA')
  await page.getByLabel('ZIP Code').fill('98109')
  await page.getByRole('button', { name: 'Use this address' }).click()
  await page.getByRole('heading', { name: 'Delivering to Olive Orders' }).waitFor()
  await page.getByLabel('Card number').fill('4242 4242 4242 4242')
  await page.getByLabel('Name on card').fill('Olive Orders')
  await page.getByLabel('Expiration month').selectOption('12')
  await page.getByLabel('Expiration year').selectOption(expYear)
  await page.getByLabel('Security code (CVV)').fill('123')
  await page.getByRole('button', { name: 'Add your card' }).click()
  await page.getByRole('heading', { name: 'Paying with Visa ending in 4242' }).waitFor()
  const first = await placeOrder()

  step('it shows under Not Yet Shipped with Track package and Cancel items')
  await page.goto(`${base}/orders?tab=not-shipped`)
  await page.getByText('1 order not yet shipped').waitFor()
  await card(first).getByText('Not yet shipped').waitFor()
  await card(first).getByRole('link', { name: 'Red Lipstick' }).waitFor()
  await card(first).getByRole('link', { name: 'Track package' }).waitFor()

  step('cancel: nothing selected is refused, then the order is cancelled')
  await card(first).getByRole('link', { name: 'Cancel items' }).click()
  await page.waitForURL(`${base}/orders/${first}/cancel`)
  await page.getByRole('checkbox').uncheck()
  await page.getByRole('button', { name: 'Request cancellation' }).click()
  await page.getByText('Please select at least one item to cancel.').waitFor()
  await page.getByRole('checkbox').check()
  await page.getByLabel('Reason for cancel (optional)').selectOption('Order Created by Mistake')
  await page.getByRole('button', { name: 'Request cancellation' }).click()
  await page.waitForURL(`${base}/orders/${first}?cancelled=1`)
  await page.getByText('This order has been cancelled.').waitFor()
  await page.getByRole('heading', { name: 'Cancelled', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: /^Demo:/ }).count(), 0)
  await page.goto(`${base}/orders?tab=cancelled`)
  await card(first).waitFor()
  await page.goto(`${base}/orders?tab=not-shipped`)
  await page.getByText('No orders here.').waitFor()
  await page.goto(`${base}/orders/${first}/cancel`)
  await page.getByText('This order has already been cancelled.').waitFor()

  step('second order with the saved address and card; tracking before it ships')
  await addToCart(6, 1)
  await page.goto(`${base}/checkout`)
  const second = await placeOrder()
  await page.goto(`${base}/orders/${second}/track`)
  await page.getByRole('heading', { name: /^Arriving / }).waitFor()
  await page.getByText('Tracking info will be available when your package ships.').waitFor()

  step('demo control marks it delivered; tracking shows the full timeline')
  await page.goto(`${base}/orders/${second}`)
  await page.getByRole('button', { name: 'Demo: mark as delivered' }).click()
  await page.getByRole('heading', { name: 'Delivered today' }).waitFor()
  await page.getByText(/^Return or replace items: Eligible through /).waitFor()
  await page.goto(`${base}/orders/${second}/track`)
  await page.getByRole('heading', { name: 'Delivered today' }).waitFor()
  await page.getByText('Delivered by nile').waitFor()
  await page.getByText(/^NL\d{14}$/).waitFor()
  await page.getByText('See all updates').click()
  await page.locator('details li').filter({ hasText: 'Out for delivery' }).waitFor()
  assert.equal(await page.locator('details li').count(), 6, 'all six tracking events are listed once delivered')
  const times = await page.locator('details li > span:first-child').allTextContents()
  assert.ok(new Set(times).size >= 4, `tracking events spread over time, not one minute: ${times}`)

  step('return: reason and comment are required, pickup fee shows, then the return starts')
  await page.getByRole('link', { name: 'Return or replace items' }).click()
  await page.waitForURL(`${base}/orders/${second}/return`)
  await page.getByRole('button', { name: 'Confirm your return' }).click()
  await page.getByText('Please select a reason for return.').waitFor()
  assert.equal(await page.getByLabel('Why are you returning this?').getAttribute('aria-invalid'), 'true')
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'return-reason', 'focus moves to the field that failed')
  await page.getByLabel('Why are you returning this?').selectOption('Item arrived damaged')
  await page.getByRole('button', { name: 'Confirm your return' }).click()
  await page.getByText('Please tell us more about the problem.').waitFor()
  await page.getByLabel('Why are you returning this?').selectOption('No longer needed')
  const refundSummary = page.getByRole('complementary', { name: 'Refund summary' })
  await page.getByLabel(/Carrier pickup/).check()
  await refundSummary.getByText('−$6.99').waitFor()
  await refundSummary.getByText('$47.12').waitFor()
  await page.getByLabel(/Drop off at a carrier store/).check()
  await refundSummary.getByText('$54.11').waitFor()
  await page.getByRole('button', { name: 'Confirm your return' }).click()
  await page.waitForURL(new RegExp(`/orders/${second}/return\\?code=RT-[A-Z0-9]{6}$`))
  await page.getByRole('heading', { name: 'Return started' }).waitFor()
  await page.getByText('Drop off by').waitFor()
  await page.getByText(/Your refund of \$54\.11/).waitFor()

  step('the order shows the return; the demo refund issues it')
  await page.getByRole('link', { name: 'Back to order' }).click()
  await page.waitForURL(`${base}/orders/${second}`)
  await page.locator('#main').getByText('Return started', { exact: true }).waitFor() // #main: the route announcer can repeat the old h1
  await page.getByRole('button', { name: 'Demo: receive returned item' }).click()
  await page.getByText('Refund issued: $54.11').waitFor()
  await page.getByText('Refund total:').waitFor()
  await page.goto(`${base}/orders/${second}/return`)
  await page.getByText('A return for this item has already started.').waitFor()
  await page.goto(`${base}/orders/${second}/invoice`)
  await page.getByRole('heading', { name: `Final Details for Order #${second}` }).waitFor()
  await page.getByText('Refund total:').waitFor()

  step('Buy it again adds to the cart; Buy Again tab and search')
  await page.goto(`${base}/orders`)
  await page.getByText('2 orders').waitFor()
  await card(second).getByRole('button', { name: /^Buy it again/ }).click()
  await card(second).getByRole('button', { name: /^✓ In cart/ }).waitFor()
  await waitCart(1)
  await page.goto(`${base}/orders?tab=buy-again`)
  await page.getByRole('link', { name: 'Calvin Klein CK One' }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Red Lipstick' }).count(), 0, 'cancelled items are not offered to buy again')
  await page.goto(`${base}/orders?q=lipstick`)
  await page.getByText('1 order matching').waitFor()
  await card(first).waitFor()
  await page.goto(`${base}/orders?q=zzzz`)
  await page.getByText('No orders matched').waitFor()

  step('partly cancelled before delivery: the return page says returns open on delivery; "7 days left" is amber')
  await addToCart(48, 2) // Bamboo Spatula sorts before the other items (the CK One from Buy it again is still in the cart)
  await addToCart(13, 3) // Bedside Table African Cherry has a 7-day return policy
  await page.goto(`${base}/checkout`)
  const third = await placeOrder()
  await page.goto(`${base}/orders/${third}/cancel`)
  await page.getByRole('checkbox', { name: /Bamboo Spatula/ }).check()
  await page.getByRole('button', { name: 'Request cancellation' }).click()
  await page.waitForURL((u) => u.pathname === `/orders/${third}`)
  await page.goto(`${base}/orders/${third}/return`)
  assert.equal((await page.locator('#main [role="alert"] p').first().textContent()).trim(), 'Returns open once your order is delivered.')
  await page.goto(`${base}/orders/${third}`)
  await page.getByRole('button', { name: 'Demo: mark as delivered' }).click()
  await page.getByRole('heading', { name: 'Delivered today' }).waitFor()
  const chip = page.locator('#main').getByText('7 days left', { exact: true })
  assert.equal(await chip.evaluate((el) => getComputedStyle(el).color), 'rgb(196, 85, 0)', '"7 days left" is amber (≤ 7 days)')

  step('PKR: USD orders keep their dollars, Buy Again follows the display currency, a PKR order adds up and stays PKR')
  await setCurrency('PKR')
  await page.goto(`${base}/orders/${second}`)
  await page.getByText('Refund issued: $54.11').waitFor()
  assert.match((await summaryRows())['Grand Total:'], /^\$/, 'an order placed in USD stays in USD')
  await page.goto(`${base}/orders?tab=buy-again`)
  await page.locator('#main li').filter({ has: page.getByRole('link', { name: 'Calvin Klein CK One' }) }).getByText('PKR', { exact: true }).waitFor()
  await addToCart(90, 1)
  await page.goto(`${base}/checkout`)
  const fourth = await placeOrder()
  await page.goto(`${base}/orders/${fourth}`)
  const r = await summaryRows()
  assert.match(r['Grand Total:'], /^PKR [\d,]+\.\d\d$/)
  assert.equal(money(r['Total before tax:']), money(r['Item(s) Subtotal:']) + money(r['Shipping & Handling:']))
  assert.equal(money(r['Grand Total:']), money(r['Total before tax:']) + money(r['Estimated tax to be collected:']), `summary adds up in PKR: ${JSON.stringify(r)}`)
  await setCurrency('USD')
  await page.goto(`${base}/orders/${fourth}`)
  assert.equal((await summaryRows())['Grand Total:'], r['Grand Total:'], 'a PKR order stays PKR after switching to USD')
  await page.goto(`${base}/orders/${fourth}/invoice`)
  await page.getByText(`Order Total: ${r['Grand Total:']}`).waitFor()

  step('390px wide: order pages fit without horizontal scrolling')
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/orders', `/orders/${second}`, `/orders/${second}/track`, `/orders/${first}/cancel`, `/orders/${second}/invoice`, '/orders?tab=buy-again', `/orders/${fourth}`]) {
    await page.goto(base + path)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} overflows at 390px`)
  }

  step("another account can't open the order (404)")
  const other = await browser.newPage()
  await other.goto(`${base}/ap/signin?return_to=%2Forders`)
  await register(other, `orders-other-${Date.now()}@example.com`)
  await other.waitForURL(`${base}/orders`)
  for (const path of [`/orders/${second}`, `/orders/${second}/track`, `/orders/${second}/return`, `/orders/${first}/cancel`]) {
    const res = await other.goto(base + path)
    assert.equal(res.status(), 404, `${path} should 404 for another account`)
    await other.getByRole('heading', { name: "We can't find that order" }).waitFor()
  }
  await other.close()

  console.log('e2e orders ok')
} catch (e) {
  await page.screenshot({ path: 'e2e/orders-failure.png', fullPage: true }).catch(() => {})
  console.error(`failed at ${page.url()} (screenshot: e2e/orders-failure.png)`)
  throw e
} finally {
  await browser.close()
}
