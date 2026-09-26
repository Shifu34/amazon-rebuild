// End-to-end smoke test through a real (headless) Chrome.
// Run with the app up: node e2e/smoke.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const email = `e2e-${Date.now()}@example.com`
const password = 'secret123'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
const cartLabel = () => page.getByRole('link', { name: /^Cart, / }).getAttribute('aria-label')
const step = (name) => console.log(`- ${name}`)

try {
  step('guest adds an item from a product page')
  await page.goto(`${base}/dp/1`)
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).click()
  await page.getByRole('dialog', { name: 'Added to cart' }).waitFor()
  assert.equal(await cartLabel(), 'Cart, 1 item')

  step('guest creates an account; the guest cart follows')
  await page.goto(`${base}/ap/signin`)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByText("Looks like you're new here").waitFor()
  await page.getByLabel('Your name').fill('Eve Tester')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Re-enter password').fill('different')
  await page.getByRole('button', { name: 'Create your nile account' }).click()
  await page.getByText('Passwords must match.').waitFor()
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Re-enter password').fill(password)
  await page.getByRole('button', { name: 'Create your nile account' }).click()
  await page.getByText('Hello, Eve').waitFor()
  assert.equal(await cartLabel(), 'Cart, 1 item')

  step('sign out empties the header cart')
  await page.getByRole('link', { name: /Account & Lists/ }).hover()
  await page.getByRole('button', { name: 'Sign Out' }).click()
  await page.getByText('Hello, sign in').waitFor()
  assert.equal(await cartLabel(), 'Cart, 0 items')

  step('sign in: wrong password, then right; account cart is back')
  await page.goto(`${base}/ap/signin`)
  await page.getByLabel('Email').fill(email.toUpperCase())
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByText('Your password is incorrect.').waitFor()
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByText('Hello, Eve').waitFor()
  assert.equal(await cartLabel(), 'Cart, 1 item')

  console.log('e2e ok')
} catch (e) {
  await page.screenshot({ path: 'e2e/failure.png', fullPage: true }).catch(() => {})
  console.error(`failed at ${page.url()} (screenshot: e2e/failure.png)`)
  throw e
} finally {
  await browser.close()
}
