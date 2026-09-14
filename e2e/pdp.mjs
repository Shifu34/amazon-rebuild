// End-to-end test for the product detail slice through headless Chrome:
// 404s, gallery + viewer, add to cart side sheet, bundle, Buy Now, browsing history, Add to List, reviews, 390px layout.
// Run with the app up: node e2e/pdp.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const { products } = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'))
const product = products.find((p) => p.id === 66) // several images, plenty of stock, has bundle picks
const other = products.find((p) => p.id === 7)
const stamp = Date.now()
const email = `pdp-${stamp}@example.com`
const headline = `Heats evenly ${stamp}`

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const step = (name) => console.log(`- ${name}`)
const cartLink = (n) => page.getByRole('link', { name: `Cart, ${n} ${n === 1 ? 'item' : 'items'}` })
const sheet = () => page.getByRole('dialog', { name: 'Added to cart' })

try {
  step('invalid ids 404')
  for (const path of ['/dp/999999', '/dp/abc', '/product-reviews/abc', '/review/create/999999']) {
    const res = await page.goto(base + path)
    assert.equal(res.status(), 404, path)
  }
  await page.getByText("Sorry! We couldn't find that page.").waitFor()

  step('product page renders; histogram adds up to 100%')
  await page.goto(`${base}/dp/${product.id}`)
  await page.getByRole('heading', { level: 1, name: product.title }).waitFor()
  const pcts = await page.getByRole('link', { name: /stars represent \d+% of rating/ }).evaluateAll((els) => els.map((e) => Number(e.getAttribute('aria-label').match(/(\d+)%/)[1])))
  assert.equal(pcts.length, 5)
  assert.equal(pcts.reduce((a, b) => a + b, 0), 100)

  step('thumbnail switches the main image; viewer opens, pages with arrows, closes on Escape')
  const main = page.getByRole('button', { name: 'Open full-screen image viewer' })
  assert.equal(await main.locator('img').getAttribute('src'), product.images[0])
  await page.getByRole('button', { name: `Image 2 of ${product.images.length}` }).click()
  assert.equal(await main.locator('img').getAttribute('src'), product.images[1])
  await main.click()
  const viewer = page.getByRole('dialog', { name: `Images: ${product.title}` })
  await viewer.waitFor()
  await page.keyboard.press('ArrowRight')
  assert.equal(await viewer.locator('img').first().getAttribute('src'), product.images[2])
  await page.keyboard.press('Escape')
  await viewer.waitFor({ state: 'hidden' })

  step('guest adds qty 2: side sheet and header count')
  await page.getByLabel('Quantity').selectOption('2')
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).click()
  await sheet().getByRole('link', { name: 'Proceed to checkout (2 items)' }).waitFor()
  await cartLink(2).waitFor()
  await page.keyboard.press('Escape')
  await sheet().waitFor({ state: 'hidden' })

  step('frequently bought together: uncheck one, add both')
  const fbt = page.getByRole('region', { name: 'Frequently bought together' })
  await fbt.getByRole('checkbox').nth(2).uncheck()
  await fbt.getByRole('button', { name: 'Add both to Cart' }).click()
  await sheet().getByRole('link', { name: 'Proceed to checkout (4 items)' }).waitFor()
  await cartLink(4).waitFor()
  await page.keyboard.press('Escape')

  step('Buy Now signed out goes to sign-in with the checkout return')
  await page.getByRole('link', { name: 'Buy Now' }).click()
  await page.waitForURL(/\/ap\/signin\?/)
  assert.equal(new URL(page.url()).searchParams.get('return_to'), `/checkout?buy=${product.id}&qty=2`)

  step('create an account, land back on a product')
  await page.goto(`${base}/ap/signin?return_to=${encodeURIComponent(`/dp/${other.id}`)}`)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Your name').fill('Pat Detail')
  await page.getByLabel('Password', { exact: true }).fill('secret123')
  await page.getByLabel('Re-enter password').fill('secret123')
  await page.getByRole('button', { name: 'Create your nile account' }).click()
  await page.getByRole('heading', { level: 1, name: other.title }).waitFor()

  step('signed-in Buy Now goes to checkout; browsing history shows the earlier product')
  await page.goto(`${base}/dp/${product.id}`)
  const buyNow = page.getByRole('link', { name: 'Buy Now' })
  assert.equal(await buyNow.getAttribute('href'), `/checkout?buy=${product.id}&qty=1`)
  await page.getByRole('region', { name: 'Your Browsing History' }).getByRole('link', { name: other.title }).waitFor()
  await buyNow.click()
  await page.waitForURL(`${base}/checkout?buy=${product.id}&qty=1`)
  await page.goto(`${base}/dp/${product.id}`)

  step('Add to List: default list, duplicate, validation, new list')
  await page.getByRole('button', { name: 'Add to List' }).click()
  await page.getByText('Added to Shopping List').waitFor()
  assert.equal(await page.getByRole('link', { name: 'View your list' }).getAttribute('href'), '/lists')
  await page.getByRole('button', { name: 'Add to List' }).click()
  await page.getByText('Already in Shopping List').waitFor()
  await page.getByRole('button', { name: 'Choose a list' }).click()
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByText('Please enter a list name').waitFor()
  await page.getByLabel('Create another list').fill('Gift ideas')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.getByText('Added to Gift ideas').waitFor()

  step('write a review: validation, thank-you, then visible on the product and reviews pages')
  await page.getByRole('link', { name: 'Write a customer review' }).click()
  await page.getByRole('heading', { name: 'Create Review' }).waitFor()
  await page.getByRole('button', { name: 'Submit' }).click()
  await page.getByText('Please select a star rating').waitFor()
  await page.getByText('Please enter your review').waitFor()
  await page.getByLabel('4 stars').check({ force: true })
  await page.getByLabel('Add a headline').fill(headline)
  await page.getByLabel('Add a written review').fill('Reheats leftovers evenly and the presets are easy to use.')
  await page.getByRole('button', { name: 'Submit' }).click()
  await page.getByText('Review submitted - Thank you!').waitFor()
  await page.getByRole('link', { name: 'Back to the product' }).click()
  const reviews = page.getByRole('region', { name: 'Customer reviews' })
  await reviews.getByText(headline).waitFor()
  await reviews.getByRole('link', { name: 'Edit your review' }).waitFor()

  await page.goto(`${base}/product-reviews/${product.id}?filterByStar=four_star`)
  await page.getByText(headline).waitFor()
  await page.getByLabel('Star rating').selectOption('one_star')
  await page.waitForURL(/filterByStar=one_star/)
  await page.getByText('FILTERED BY').waitFor()
  assert.equal(await page.getByText(headline).count(), 0)

  step('390px wide: no horizontal page scroll')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/dp/${product.id}`)
  await page.getByRole('heading', { level: 1, name: product.title }).waitFor()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(overflow <= 0, `page overflows by ${overflow}px`)

  console.log('pdp e2e ok')
} catch (e) {
  await page.screenshot({ path: 'e2e/pdp-failure.png', fullPage: true }).catch(() => {})
  console.error(`failed at ${page.url()} (screenshot: e2e/pdp-failure.png)`)
  throw e
} finally {
  await browser.close()
}
