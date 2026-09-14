// Regression: header search suggestions must not close and pop back open over the page on every keystroke.
// Simulates production API latency and a deliberate typist, then counts list opens/closes frame by frame.
// Run with the app up: node e2e/suggest.mjs [baseUrl]
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.route('**/api/suggest**', async (route) => {
  await new Promise((r) => setTimeout(r, 300))
  await route.continue()
})

try {
  console.log('- typing slowly keeps one open suggestion list')
  await page.goto(base, { waitUntil: 'networkidle' })
  const box = page.locator('input[role="combobox"]').first()
  await box.click()
  await page.evaluate(() => {
    window.__open = []
    const tick = () => {
      const list = document.querySelector('[role="listbox"]')
      window.__open.push(!!list && list.getBoundingClientRect().height > 0)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  for (const ch of 'iphone') {
    await page.keyboard.type(ch)
    await page.waitForTimeout(700) // long enough for each answer to land before the next key
  }
  const open = await page.evaluate(() => window.__open)
  let opens = 0
  let closes = 0
  for (let i = 1; i < open.length; i++) {
    if (open[i] && !open[i - 1]) opens++
    if (!open[i] && open[i - 1]) closes++
  }
  assert.equal(closes, 0, `suggestion list closed ${closes} times while typing`)
  assert.equal(opens, 1, `suggestion list opened ${opens} times while typing`)

  console.log('- the final list matches what was typed')
  await page.getByRole('option', { name: /iphone/i }).first().waitFor()

  console.log('- clearing the box closes the list')
  await box.fill('')
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'))

  console.log('suggest ok')
} finally {
  await browser.close()
}
