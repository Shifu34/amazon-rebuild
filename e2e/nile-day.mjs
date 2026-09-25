// Your nile day end to end in headless Chrome: choose the day on Your Account, see the pooled option at checkout with its
// date and saving, place it, and find the credit and "Arriving on your nile day" on the order.
// Run with the app up: node e2e/nile-day.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const email = `nileday-${Date.now()}@example.com`

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
// US dollars wherever this runs from, and under $35 so standard shipping is charged and pooling has something to hand back
await page.context().addCookies([{ name: 'currency', value: 'USD', url: base }, { name: 'ship_country', value: 'US', url: base }])
const step = (name) => console.log(`- ${name}`)
const dollars = (text) => Number(text.replace(/[^\d.-]/g, ''))
const summary = () => page.getByRole('complementary', { name: 'Order summary' })
const row = (scope, label) => scope.locator('dl > div').filter({ hasText: label }).locator('dd')

try {
  step('sign up and put one cheap item in the cart')
  await page.goto(`${base}/dp/1`)
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
  await page.goto(`${base}/checkout`)
  await page.waitForURL(/\/ap\/signin/)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Your name').fill('Nile Day')
  await page.getByLabel('Password', { exact: true }).fill('secret123')
  await page.getByLabel('Re-enter password').fill('secret123')
  await page.getByRole('button', { name: 'Create your nile account' }).click()
  await page.waitForURL(`${base}/checkout`)

  step('address and card, then read the standard delivery date')
  await page.getByLabel('Full name (First and Last name)').fill('Nile Day')
  await page.getByLabel('Phone number').fill('(206) 555-0100')
  await page.getByLabel('Address', { exact: true }).fill('410 Terry Ave N')
  await page.getByLabel('City').fill('Seattle')
  await page.getByLabel('Country/Region').selectOption('US')
  await page.getByLabel('State', { exact: true }).selectOption('WA')
  await page.getByLabel('ZIP Code').fill('98109')
  await page.getByRole('button', { name: 'Use this address' }).click()
  await page.getByRole('heading', { name: 'Delivering to Nile Day' }).waitFor()
  await page.getByRole('button', { name: 'Use test card' }).click()
  await page.getByRole('button', { name: 'Add your card' }).click()
  await page.getByRole('heading', { name: 'Paying with Visa ending in 4242' }).waitFor()
  const options = page.getByRole('group', { name: 'Choose your delivery option:' })
  const standardText = await options.locator('label').first().innerText()
  // two days past the standard promise, so pooling always waits and always has a saving to show
  const wanted = DAYS[(DAYS.indexOf(standardText.split(',')[0].trim()) + 2) % 7]
  const shippingPaid = dollars(await row(summary(), 'Shipping & handling:').textContent())
  assert.ok(shippingPaid > 0, 'an order under $35 pays shipping, so pooling can hand it back')

  step('set the nile day on Your Account')
  await page.goto(`${base}/account`)
  const nileDay = page.getByRole('region', { name: 'Your nile day' })
  await nileDay.getByLabel('Deliver my week on').selectOption(wanted)
  await nileDay.getByRole('button', { name: 'Turn on' }).click()
  await nileDay.getByText(`your orders arrive on ${wanted}`).waitFor()
  // the select must show the saved day, not the one it happened to mount with
  assert.equal(await nileDay.getByLabel('Deliver my week on').inputValue(), String(DAYS.indexOf(wanted)))

  step('checkout offers the pooled option, dated and priced')
  await page.goto(`${base}/checkout`)
  const pooled = options.locator('label').filter({ hasText: 'With the rest of your week' })
  await pooled.waitFor()
  assert.ok(await pooled.getByRole('radio').isChecked(), 'the chosen day selects the pooled option')
  const pooledText = await pooled.innerText()
  assert.equal(pooledText.split(',')[0].trim(), wanted, `the pooled date is a ${wanted}`)
  assert.ok(pooledText.includes(`you save $${shippingPaid.toFixed(2)}`), `the saving is the shipping: ${pooledText}`)
  assert.equal(await options.getByLabel('Your nile day').inputValue(), String(DAYS.indexOf(wanted)))

  step('the summary carries the credit and still adds up')
  const credit = dollars(await row(summary(), 'Nile day credit:').textContent())
  assert.equal(credit, -shippingPaid, 'the credit cancels the shipping')
  const items = dollars(await row(summary(), 'Items (').textContent())
  const tax = dollars(await row(summary(), 'Estimated tax').textContent())
  assert.equal(dollars(await row(summary(), 'Order total:').textContent()), Math.round((items + shippingPaid + credit + tax) * 100) / 100)

  step('place it: the order says why it waits, and the credit is on the summary')
  await page.getByRole('button', { name: 'Place your order' }).first().click()
  await page.waitForURL(/\/thankyou\/113-\d{7}-\d{7}$/)
  const orderId = new URL(page.url()).pathname.split('/').pop()
  await page.goto(`${base}/orders/${orderId}`)
  await page.getByText('Arriving on your nile day').waitFor()
  const totals = page.getByRole('region', { name: 'Order summary' })
  assert.equal(dollars(await row(totals, 'Nile day credit:').textContent()), -shippingPaid)
  const grand = dollars(await row(totals, 'Grand Total:').textContent())
  const parts = ['Item(s) Subtotal:', 'Shipping & Handling:', 'Nile day credit:', 'Estimated tax to be collected:']
  const sum = (await Promise.all(parts.map(async (p) => dollars(await row(totals, p).textContent())))).reduce((a, b) => a + b, 0)
  assert.equal(grand, Math.round(sum * 100) / 100, 'the order summary adds up')
  await page.getByRole('link', { name: 'Back to Your Orders' }).click()
  await page.getByText('Arriving on your nile day').first().waitFor()

  step('turning it off ships as ordered again')
  await page.goto(`${base}/account`)
  await page.getByRole('region', { name: 'Your nile day' }).getByRole('button', { name: 'Turn off' }).click()
  await page.getByRole('region', { name: 'Your nile day' }).getByRole('button', { name: 'Turn on' }).waitFor()

  console.log('nile day e2e passed')
} catch (e) {
  await page.screenshot({ path: 'e2e/nile-day-failure.png' }).catch(() => {})
  console.error(e)
  process.exitCode = 1
} finally {
  await browser.close()
}
