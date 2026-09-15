// Quick look on product carousels in headless Chrome: the pill shows on hover, the dialog opens with title, price and a
// product link, an also-bought thumbnail switches the product in place, Esc closes back onto the button, and touch
// screens don't get the pill.
// Run with the app up: node e2e/quick-look.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const ROW = 'section[aria-label="Customers who viewed this item also viewed"]'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
// US dollars wherever the test runs from (the live site picks rupees for a Pakistani IP)
await page.context().addCookies([{ name: 'currency', value: 'USD', url: base }, { name: 'ship_country', value: 'US', url: base }])
const step = (name) => console.log(`- ${name}`)
const opacity = (locator) => locator.evaluate((el) => getComputedStyle(el).opacity)

try {
  step('the Quick look pill appears when a carousel card is hovered')
  await page.goto(`${base}/dp/66`)
  const row = page.locator(ROW)
  await row.scrollIntoViewIfNeeded()
  const card = row.getByRole('listitem').nth(1)
  const title = await card.locator('div + div a').textContent()
  const href = await card.locator('div + div a').getAttribute('href')
  const button = card.getByRole('button', { name: `Quick look: ${title}` })
  assert.equal(await opacity(button), '0')
  await card.hover()
  await page.waitForFunction((b) => getComputedStyle(b).opacity === '1', await button.elementHandle())

  step('the dialog shows the product: title, price and See product details')
  await button.click()
  const dialog = page.getByRole('dialog', { name: title })
  await dialog.waitFor()
  const details = dialog.getByRole('link', { name: 'See product details' })
  await details.waitFor()
  assert.equal(await details.getAttribute('href'), href)
  await dialog.getByText(/^\$[\d,]+\.\d{2}$/).waitFor()
  await dialog.getByRole('heading', { name: 'Customers also bought' }).waitFor()

  step('an also-bought thumbnail switches the dialog to that product')
  // the dialog's name follows the product shown, so find the strip by the open dialog instead
  const thumbs = page.locator('dialog[open]').getByRole('listitem').getByRole('button')
  assert.ok((await thumbs.count()) > 2)
  assert.equal(await thumbs.first().getAttribute('aria-current'), 'true')
  const other = thumbs.nth(2)
  const otherTitle = await other.getAttribute('aria-label')
  await other.click()
  await page.getByRole('dialog', { name: otherTitle }).getByRole('heading', { name: otherTitle }).waitFor()
  assert.equal(await other.getAttribute('aria-current'), 'true')
  await page.waitForFunction((was) => document.querySelector('dialog[open] a.btn-cart')?.getAttribute('href') !== was, href)

  step('Esc closes it and focus goes back to the Quick look button')
  await page.keyboard.press('Escape')
  await page.locator('dialog[open]').waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), `Quick look: ${title}`)

  step("search results, Today's Deals and Best Sellers cards open Quick look too")
  for (const [path, cards] of [['/s?i=electronics', 'main li article'], ['/', 'section[aria-label="Today\'s Deals"] li'], ['/bestsellers/electronics', 'main li article']]) {
    await page.goto(base + path)
    const c = page.locator(cards).first()
    await c.scrollIntoViewIfNeeded()
    await c.hover()
    const b = c.getByRole('button', { name: /^Quick look: / })
    await page.waitForFunction((el) => getComputedStyle(el).opacity === '1', await b.elementHandle())
    const name = (await b.getAttribute('aria-label')).replace('Quick look: ', '')
    await b.click()
    await page.getByRole('dialog', { name }).getByRole('link', { name: 'See product details' }).waitFor()
    await page.keyboard.press('Escape')
    await page.locator('dialog[open]').waitFor({ state: 'detached' })
  }

  step('touch screens (390px) have no Quick look pill')
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const phone = await touch.newPage()
  await phone.goto(`${base}/dp/66`)
  // a CSS locator: role queries skip display:none, which is the point here
  const phoneButton = phone.locator(`${ROW} button[aria-haspopup="dialog"]`).first()
  await phoneButton.waitFor({ state: 'attached' })
  assert.equal(await phoneButton.isVisible(), false)
  await touch.close()

  console.log('quick look e2e passed')
} catch (e) {
  await page.screenshot({ path: 'e2e/quick-look-failure.png', fullPage: false }).catch(() => {})
  console.error(e)
  process.exitCode = 1
} finally {
  await browser.close()
}
