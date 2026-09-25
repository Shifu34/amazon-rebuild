// Compare end to end in headless Chrome: ticking result cards fills the docked tray, the table lines the picks up side by
// side, "Show differences only" hides rows where every column matches, and remove/clear empty it again.
// Run with the app up: node e2e/compare.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
// US dollars wherever the test runs from (the live site picks rupees for a Pakistani IP)
await page.context().addCookies([{ name: 'currency', value: 'USD', url: base }, { name: 'ship_country', value: 'US', url: base }])
const step = (name) => console.log(`- ${name}`)
const tray = () => page.getByRole('region', { name: 'Compare' })
const columns = (p = page) => p.locator('thead th[scope="col"]:not(:first-child)')
const row = (label, p = page) => p.getByRole('row').filter({ has: p.getByRole('rowheader', { name: label, exact: true }) })

async function tick(index) {
  const card = page.locator('main li article').nth(index)
  const title = (await card.getByRole('heading').innerText()).trim()
  await card.getByRole('checkbox').check()
  return title
}

try {
  step('ticking three result cards fills the tray')
  await page.goto(`${base}/s?i=smartphones`)
  assert.equal(await tray().count(), 0, 'no tray before anything is selected')
  const picked = []
  for (const i of [0, 1, 2]) picked.push(await tick(i))
  await tray().waitFor()
  assert.equal(await tray().getByRole('listitem').count(), 3)

  step('a fifth pick is refused, with the limit in the checkbox name')
  const fourth = await tick(3)
  const fifth = page.locator('main li article').nth(4).getByRole('checkbox')
  assert.equal(await fifth.isDisabled(), true, 'the fifth checkbox is disabled at the limit')
  assert.match(await fifth.getAttribute('aria-label'), /compare up to 4 items/i)
  await page.locator('main li article').nth(3).getByRole('checkbox').uncheck() // back to three
  assert.equal(await tray().getByRole('listitem').count(), 3, `${fourth} removed again`)

  step('the tray opens the table with a column per pick')
  await tray().getByRole('link', { name: 'Compare (3)' }).click()
  await page.waitForURL(`${base}/compare`)
  await page.getByRole('heading', { level: 1, name: 'Compare products' }).waitFor()
  assert.equal(await columns().count(), 3)
  for (const title of picked) await page.getByRole('columnheader', { name: new RegExp(escape(title)) }).waitFor()
  await row('Price').waitFor()
  assert.match(await row('Price').innerText(), /\$/, 'prices follow the display currency')

  step('"Show differences only" hides the rows where every column matches')
  const category = row('Category')
  assert.equal(await category.getAttribute('data-same'), 'true', 'three phones share a category')
  const warranty = row('Warranty')
  assert.equal(await category.isVisible(), true)
  await page.getByRole('checkbox', { name: 'Show differences only' }).check()
  await category.waitFor({ state: 'hidden' })
  assert.equal(await warranty.isVisible(), (await warranty.getAttribute('data-same')) !== 'true')
  await page.getByRole('checkbox', { name: 'Show differences only' }).uncheck()
  await category.waitFor()

  step('removing a column drops it from the table and the tray')
  await page.getByRole('columnheader', { name: new RegExp(escape(picked[0])) }).getByRole('button', { name: /^Remove / }).click()
  await page.waitForFunction(() => document.querySelectorAll('thead th[scope="col"]:not(:first-child)').length === 2)
  assert.equal(await tray().getByRole('listitem').count(), 2)

  step('Clear empties the tray and the table shows its empty state')
  await tray().getByRole('button', { name: 'Clear' }).click()
  await page.getByRole('heading', { level: 1, name: 'Nothing to compare yet' }).waitFor()
  assert.equal(await tray().count(), 0)

  step('390px: the tray fits and the table scrolls inside its own container')
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  await phone.addCookies([{ name: 'currency', value: 'USD', url: base }, { name: 'ship_country', value: 'US', url: base }])
  const small = await phone.newPage()
  await small.goto(`${base}/s?i=smartphones`)
  for (const i of [0, 1]) await small.locator('main li article').nth(i).getByRole('checkbox').check()
  await small.getByRole('region', { name: 'Compare' }).getByRole('link', { name: 'Compare (2)' }).click()
  await small.waitForURL(`${base}/compare`)
  assert.equal(await columns(small).count(), 2)
  // the page itself must not scroll sideways; the table scrolls inside its own container, all the way to the last column
  // (documentElement.scrollWidth over-reports here, so ask whether the page actually moves)
  const scrolled = await small.evaluate(() => {
    window.scrollTo(400, 0)
    const x = window.scrollX
    window.scrollTo(0, 0)
    const table = document.querySelector('table')
    const box = table.closest('.overflow-x-auto') // the header has its own scrolling strip, so start from the table
    return { page: x, reach: box.scrollWidth - box.clientWidth, table: table.getBoundingClientRect().width }
  })
  assert.equal(scrolled.page, 0, 'the page does not scroll sideways at 390px')
  assert.ok(scrolled.reach >= scrolled.table - 391, `the table scrolls far enough to reach its last column (${JSON.stringify(scrolled)})`)
  await small.getByRole('columnheader', { name: new RegExp(escape(picked[1])) }).scrollIntoViewIfNeeded()
  await phone.close()

  console.log('compare e2e passed')
} catch (e) {
  await page.screenshot({ path: 'e2e/compare-failure.png' }).catch(() => {})
  console.error(e)
  process.exitCode = 1
} finally {
  await browser.close()
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
