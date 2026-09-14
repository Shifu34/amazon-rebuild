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
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage() // a context, so a second tab can share the cart
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
  assert.match(await page.getByRole('link', { name: 'View your list' }).getAttribute('href'), /^\/lists\/[0-9a-f-]{36}$/)
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

  step('1280x800: the list menu paints above the sticky "On this page" bar and a mouse click on the second list saves')
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`${base}/dp/12`) // short centre column, so the bar sits right under the buy box
  const giftRow = page.getByRole('button', { name: 'Gift ideas' })
  for (let i = 0; i < 5 && !(await giftRow.isVisible()); i++) {
    await page.getByRole('button', { name: 'Choose a list' }).click() // retried in case the click beat hydration
    await giftRow.waitFor({ timeout: 2000 }).catch(() => {})
  }
  const covered = await page.locator('button[name="listId"]').evaluateAll((els) =>
    els.filter((el) => {
      const r = el.getBoundingClientRect()
      return !el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
    }).map((el) => el.textContent),
  )
  assert.deepEqual(covered, [], 'list rows painted over')
  const row = await giftRow.boundingBox()
  await page.mouse.click(row.x + row.width / 2, row.y + row.height / 2)
  await page.getByText('added to Gift ideas').waitFor()

  step('the deal tag reads "Deal": nothing expires, so no "Limited time deal"')
  await page.getByText('Deal', { exact: true }).first().waitFor()
  assert.doesNotMatch(await page.locator('body').innerText(), /limited time deal/i)

  step('a stale second tab adding past the 30 cap: the sheet reports what actually went in')
  const addQty = async (tab, n) => {
    const box = tab.getByRole('complementary', { name: 'Buy box' })
    await box.getByLabel('Quantity').selectOption(String(n))
    await box.getByRole('button', { name: 'Add to Cart', exact: true }).click()
    const added = tab.getByRole('dialog', { name: 'Added to cart' })
    await added.waitFor()
    const text = await added.innerText()
    await tab.keyboard.press('Escape')
    await added.waitFor({ state: 'hidden' })
    return text
  }
  await page.goto(`${base}/dp/3`)
  await addQty(page, 20)
  const stale = await page.context().newPage()
  await stale.goto(`${base}/dp/3`) // renders with 20 in the cart
  await addQty(page, 7) // 27 now, but the stale tab still offers 1-10
  const staleText = await addQty(stale, 8)
  await stale.close()
  assert.match(staleText, /Qty: 3\b/)
  assert.match(staleText, /Only 3 added/)

  step('390px wide: no horizontal page scroll; buy box and sheet buttons are 44px touch targets')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/dp/${product.id}`)
  await page.getByRole('heading', { level: 1, name: product.title }).waitFor()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(overflow <= 0, `page overflows by ${overflow}px`)
  const tall = async (loc, name) => {
    await loc.waitFor()
    const { height } = await loc.boundingBox()
    assert.ok(height >= 44, `${name} is ${height}px tall`)
  }
  const buyBox = page.getByRole('complementary', { name: 'Buy box' })
  await tall(buyBox.getByRole('link', { name: 'Buy Now' }), 'Buy Now')
  await tall(buyBox.getByRole('button', { name: 'Add to Cart', exact: true }), 'Add to Cart')
  await buyBox.getByRole('button', { name: 'Add to Cart', exact: true }).click()
  await tall(sheet().getByRole('link', { name: /Proceed to checkout/ }), 'Proceed to checkout')
  await tall(sheet().getByRole('link', { name: 'Go to Cart' }), 'Go to Cart')

  console.log('pdp e2e ok')
} catch (e) {
  await page.screenshot({ path: 'e2e/pdp-failure.png', fullPage: true }).catch(() => {})
  console.error(`failed at ${page.url()} (screenshot: e2e/pdp-failure.png)`)
  throw e
} finally {
  await browser.close()
}
