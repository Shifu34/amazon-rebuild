// Regression: images in horizontal rows must already be loaded when the shopper scrolls sideways, not pop in.
// Brings each row near the screen, waits briefly without scrolling it, then checks every image in the row (including
// the ones past the right edge) has loaded.
// Run with the app up: node e2e/carousel.mjs [baseUrl]
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

async function checkRows(route, rowNames) {
  await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' })
  for (const name of rowNames) {
    const row = page.getByRole('region', { name }).or(page.locator(`section[aria-label="${name}"]`)).first()
    await row.scrollIntoViewIfNeeded()
    // the shopper reads the row for a moment before scrolling it
    await page.waitForFunction(
      (label) => {
        const section = document.querySelector(`section[aria-label="${CSS.escape(label)}"]`)
        const imgs = section ? [...section.querySelectorAll('ul img')] : []
        return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0)
      },
      name,
      { timeout: 6000 },
    ).catch(() => {})
    const state = await row.evaluate((section) => {
      const list = section.querySelector('ul')
      const imgs = [...list.querySelectorAll('img')]
      const right = list.getBoundingClientRect().right
      const offscreen = imgs.filter((img) => img.getBoundingClientRect().left > right)
      return {
        total: imgs.length,
        offscreen: offscreen.length,
        offscreenLoaded: offscreen.filter((img) => img.complete && img.naturalWidth > 0).length,
        scrollLeft: list.scrollLeft,
      }
    })
    console.log(`- ${route} "${name}": ${state.offscreenLoaded}/${state.offscreen} off-screen images ready (of ${state.total})`)
    assert.equal(state.scrollLeft, 0, 'row was not scrolled by the test')
    assert.ok(state.offscreen > 0, `"${name}" should have cards past the right edge to test`)
    assert.equal(state.offscreenLoaded, state.offscreen, `"${name}": images past the right edge not loaded before scrolling`)
  }
}

try {
  await checkRows('/', ['Best Sellers in Home & Kitchen', "Today's Deals"])
  await checkRows('/dp/135', ['Customers who viewed this item also viewed'])
  console.log('carousel ok')
} finally {
  await browser.close()
}
