// Every link in the header, footer, departments drawer and account pages resolves (no 4xx/5xx), signed out and signed in.
// Run with the app up: node e2e/links.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
const step = (name) => console.log(`- ${name}`)

const hrefs = (selector) => page.locator(selector).evaluateAll((as) => as.map((a) => a.getAttribute('href')))

async function linksOn(path, selector) {
  await page.goto(base + path)
  const found = await hrefs(selector)
  if (selector.startsWith('header')) {
    await page.getByRole('button', { name: 'Open menu: all departments' }).first().click()
    const drawer = page.getByRole('dialog', { name: 'All departments' })
    await drawer.waitFor()
    const toggles = drawer.locator('button[aria-expanded]')
    for (let i = 0; i < (await toggles.count()); i++) {
      await toggles.nth(i).click()
      found.push(...(await hrefs('[role="dialog"] a[href]')))
    }
  }
  return found
}

async function check(label, found) {
  const urls = [...new Set(found.filter((h) => h && h.startsWith('/')))]
  const bad = []
  for (const url of urls) {
    const res = await page.request.get(base + url)
    if (res.status() >= 400) bad.push(`${res.status()} ${url}`)
  }
  console.log(`  ${urls.length} links checked`)
  assert.deepEqual(bad, [], `${label}: broken links`)
}

try {
  step('signed out: header, drawer and footer')
  await check('signed out', await linksOn('/', 'header a[href], footer a[href]'))

  step('signed out: an unknown URL is a real 404 with a way home')
  const res = await page.goto(`${base}/no-such-page`)
  assert.equal(res.status(), 404)
  await page.getByRole('heading', { name: "Sorry, we couldn't find that page" }).waitFor()
  await page.getByRole('link', { name: "nile's home page" }).waitFor()

  step('create an account')
  await page.goto(`${base}/ap/signin`)
  await page.getByLabel('Email').fill(`links-${Date.now()}@example.com`)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Your name').fill('Lin Links')
  await page.getByLabel('Password', { exact: true }).fill('secret123')
  await page.getByLabel('Re-enter password').fill('secret123')
  await page.getByRole('button', { name: 'Create your nile account' }).click()
  await page.getByText('Hello, Lin').waitFor()

  step('signed in: header, drawer and footer')
  await check('signed in', await linksOn('/', 'header a[href], footer a[href]'))

  step('signed in: account pages')
  const found = []
  for (const path of ['/account', '/account/security', '/account/addresses', '/account/payments', '/lists', '/history']) {
    found.push(path, ...(await linksOn(path, 'main a[href]')))
  }
  await check('account pages', found)

  console.log('e2e links ok')
} catch (e) {
  await page.screenshot({ path: 'e2e/failure.png', fullPage: true }).catch(() => {})
  console.error(`failed at ${page.url()} (screenshot: e2e/failure.png)`)
  throw e
} finally {
  await browser.close()
}
