// Search & browse e2e through headless Chrome.
// Run with the app up: node e2e/search.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
let page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const step = (name) => console.log(`- ${name}`)
const h1 = () => page.getByRole('heading', { level: 1 }).first()
const until = async (fn, message) => {
  for (let i = 0; i < 80; i++) {
    if (await fn().catch(() => false)) return
    await page.waitForTimeout(100)
  }
  throw new Error(message)
}
// the first .sr-only in a ProductCard is its spoken price, e.g. "$1,099.99" or "PKR 304,544.23"
const prices = () => page.locator('main article').evaluateAll((cards) => cards.map((c) => Number(c.querySelector('.sr-only').textContent.replace(/[^\d.]/g, ''))))
const cartCount = async () => Number((await page.getByRole('link', { name: /^Cart, / }).getAttribute('aria-label')).match(/\d+/)[0])

try {
  step('search "phone" from the header box')
  await page.goto(base)
  await page.getByRole('combobox', { name: 'Search nile' }).fill('phone')
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/s\?k=phone$/)
  await page.getByRole('heading', { level: 1, name: /^1-24 of \d+ results for "phone"$/ }).waitFor()
  const total = Number((await h1().innerText()).match(/of (\d+)/)[1])
  assert.ok(total > 24, 'phone needs more than one page')
  assert.equal(await page.title(), 'nile.com : phone')
  assert.equal(await page.locator('main article').count(), 24)
  // white 12px bold on the Best Seller badge needs AA (4.5:1): #c45500 reaches it, the old #e67a00 was 2.93:1
  assert.equal(await page.getByText('Best Seller', { exact: true }).first().evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(196, 85, 0)')

  step('brand filter narrows results and shows a chip')
  await page.getByRole('checkbox', { name: /^Samsung/ }).click()
  await page.waitForURL(/brand=Samsung/)
  const chip = page.getByRole('link', { name: 'Remove filter: Samsung' })
  await chip.waitFor()
  await until(async () => /^\d+ results? for "phone"$/.test(await h1().innerText()), 'count line did not narrow')
  const narrowed = Number((await h1().innerText()).match(/^\d+/)[0])
  assert.ok(narrowed > 0 && narrowed < total)
  assert.equal(await page.locator('main article').count(), narrowed)
  assert.equal(await page.getByRole('checkbox', { name: /^Samsung/ }).getAttribute('aria-checked'), 'true')

  step('removing the chip restores all results')
  await chip.click()
  await page.getByRole('heading', { level: 1, name: new RegExp(`of ${total} results`) }).waitFor()
  assert.equal(await page.getByRole('link', { name: /^Remove filter/ }).count(), 0)

  step('price sort orders results low to high')
  await page.getByLabel('Sort by:').selectOption('price-asc')
  await page.waitForURL(/sort=price-asc/)
  await until(async () => {
    const p = await prices()
    return p.length === 24 && p.every((x, i) => i === 0 || p[i - 1] <= x)
  }, 'prices are not ascending')
  const lastOnPage1 = (await prices()).at(-1)

  step('pagination keeps sort and continues the order')
  await page.getByRole('navigation', { name: 'Pagination' }).getByRole('link', { name: /Next/ }).click()
  await page.waitForURL(/page=2/)
  assert.match(page.url(), /sort=price-asc/)
  await page.getByRole('heading', { level: 1, name: new RegExp(`^25-${total} of ${total} results`) }).waitFor()
  const page2 = await prices()
  assert.equal(page2.length, total - 24)
  assert.ok(page2[0] >= lastOnPage1, 'page 2 continues the sort')
  assert.equal(await page.locator('[aria-current="page"]').innerText(), '2')

  step('add to cart from results updates the header')
  const before = await cartCount()
  await page.getByRole('button', { name: 'Add to cart' }).first().click()
  await until(async () => (await cartCount()) === before + 1, 'cart count did not go up')

  step('misspelling is corrected, with a way back')
  await page.goto(`${base}/s?k=iphnoe`)
  await page.getByText('Showing results for').waitFor()
  assert.match(await h1().innerText(), /results? for "iphone"/)
  await page.getByRole('link', { name: 'iphnoe' }).click()
  await page.getByRole('heading', { level: 1, name: 'No results for iphnoe.' }).waitFor()

  step('no-results query shows the empty state')
  await page.goto(`${base}/s?k=zzqqxx`)
  await page.getByRole('heading', { level: 1, name: 'No results for zzqqxx.' }).waitFor()
  await page.getByText('Try checking your spelling or use more general terms').waitFor()
  await page.getByRole('heading', { name: 'Popular departments' }).waitFor()

  step('department browse and invalid params')
  await page.goto(`${base}/s?i=smartphones`)
  await page.getByRole('heading', { level: 1, name: /results for Electronics : Cell Phones$/ }).waitFor()
  await page.getByRole('link', { name: '‹ Any Department' }).waitFor()
  const res = await page.goto(`${base}/s?i=constructor&page=abc&sort=bogus&min=x&rating=9&brand=`)
  assert.equal(res.status(), 200)
  await page.getByRole('heading', { level: 1, name: /^1-24 of \d+ results$/ }).waitFor()

  step('no vehicles or motorcycles: Automotive is gone from the header, search and old links')
  assert.equal(await page.locator('header a[href="/s?i=automotive"]').count(), 0)
  for (const k of ['motorcycle', 'durango']) {
    await page.goto(`${base}/s?k=${k}`)
    await h1().waitFor()
    assert.equal(await page.locator('main article').count(), 0, `"${k}" finds nothing`)
  }
  await page.goto(`${base}/s?i=automotive`)
  assert.doesNotMatch(await h1().innerText(), /Automotive/)

  step('a Deal needs stock: an unavailable item has no deal tag and stays out of the deals filter')
  await page.goto(`${base}/s?k=volleyball&oos=1`)
  const unavailable = page.locator('main article', { hasText: 'Currently unavailable.' })
  await unavailable.first().waitFor()
  assert.equal(await unavailable.getByText('Deal', { exact: true }).count(), 0)
  await page.goto(`${base}/s?k=volleyball&oos=1&deals=1`)
  await h1().waitFor()
  assert.equal(await unavailable.count(), 0)

  step('mobile (390px): filter drawer opens, filters live, closes')
  await page.close()
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  await page.goto(`${base}/s?k=phone`)
  await h1().waitFor()
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'no horizontal scroll')
  const drawer = page.getByRole('complementary', { name: 'Filters' })
  assert.equal(await drawer.isVisible(), false)
  await page.getByRole('button', { name: /^Filters/ }).click()
  await drawer.waitFor()
  await drawer.getByRole('checkbox', { name: /^Apple/ }).click()
  await page.waitForURL(/brand=Apple/)
  const show = drawer.getByRole('button', { name: /^Show \d+ results?$/ })
  await until(async () => (await show.innerText()) !== `Show ${total} results`, 'drawer count did not update')
  await show.click()
  await drawer.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Filters (1)' }).waitFor()

  step('Pakistan (x-vercel-ip-country: PK): rupee prices, the international delivery fee, rupee price bands and typed rupees')
  await page.close()
  const pk = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-vercel-ip-country': 'PK' } })
  page = await pk.newPage()
  await page.goto(`${base}/s?k=phone`)
  await h1().waitFor()
  assert.match(await page.locator('main article .sr-only').first().textContent(), /^PKR [\d,]+\.\d{2}$/)
  await page.locator('main article').first().getByText(/^PKR 4,153\.28 delivery/).waitFor()
  assert.equal(await page.locator('main').getByText(/FREE delivery|\$/).count(), 0, 'no dollars and no free delivery to Pakistan')
  const filters = page.getByRole('complementary', { name: 'Filters' })
  await filters.getByRole('link', { name: /^Up to PKR 5,000/ }).click()
  await page.waitForURL(/max=18\.046$/)
  await page.getByRole('link', { name: 'Remove filter: Up to PKR 5,000' }).waitFor()
  assert.ok((await prices()).every((x) => x <= 5000), 'band keeps prices under PKR 5,000')
  await filters.getByLabel('Minimum price, in Pakistani Rupees').fill('5000')
  await filters.getByLabel('Maximum price, in Pakistani Rupees').fill('15000')
  await filters.getByRole('button', { name: 'Go' }).click()
  await page.waitForURL(/min=5000&max=15000&cur=PKR/)
  await page.getByRole('link', { name: 'Remove filter: PKR 5,000 to 15,000' }).waitFor()
  const typed = await prices()
  assert.ok(typed.length && typed.every((x) => x >= 5000 && x <= 15000), `typed rupee range: ${typed}`)
  assert.equal(await filters.getByLabel('Minimum price, in Pakistani Rupees').inputValue(), '5000', 'the box reads back in rupees')
  await page.getByRole('combobox', { name: 'Search nile' }).fill('iphone')
  await page.getByRole('option', { name: /PKR [\d,]+\.\d{2}$/ }).first().waitFor()

  step('Pakistan with the currency set to USD: dollar prices, still the $14.99 international fee')
  await pk.addCookies([{ name: 'currency', value: 'USD', url: base }])
  await page.goto(`${base}/s?k=phone`)
  await page.locator('main article').first().getByText(/^\$14\.99 delivery/).waitFor()

  step('Pakistan at 390px: no sideways scroll with rupee prices')
  await pk.clearCookies()
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/s?k=phone', '/s?sort=price-desc']) {
    await page.goto(base + path)
    await h1().waitFor()
    assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, `${path} scrolls sideways`)
  }

  console.log('e2e search ok')
} catch (e) {
  await page.screenshot({ path: 'e2e/failure.png', fullPage: true }).catch(() => {})
  console.error(`failed at ${page.url()} (screenshot: e2e/failure.png)`)
  throw e
} finally {
  await browser.close()
}
