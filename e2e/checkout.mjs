// Cart and checkout end to end in headless Chrome: guest cart edits, sign-in gate, address and card validation,
// delivery speed, place order, thank-you, empty cart, buy now (declined card first) and 390px layout.
// Run with the app up: node e2e/checkout.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const email = `checkout-${Date.now()}@example.com`
const password = 'secret123'
const expYear = String(new Date().getFullYear() + 2)

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const step = (name) => console.log(`- ${name}`)
const cartLabel = () => page.getByRole('link', { name: /^Cart, / }).getAttribute('aria-label')
const waitCart = (n) =>
  page.waitForFunction((n) => document.querySelector('a[aria-label^="Cart, "]')?.getAttribute('aria-label') === `Cart, ${n} ${n === 1 ? 'item' : 'items'}`, n)
const summary = () => page.getByRole('complementary', { name: 'Order summary' })
const amount = async (label) => Number((await summary().locator('dl > div').filter({ hasText: label }).locator('dd').textContent()).replace(/[^\d.-]/g, ''))

async function addFromProductPage(id, expectedCount) {
  await page.goto(`${base}/dp/${id}`)
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
  await waitCart(expectedCount)
}

async function addCard(number) {
  await page.getByLabel('Card number').fill(number)
  await page.getByLabel('Name on card').fill('Eve Tester')
  await page.getByLabel('Expiration month').selectOption('12')
  await page.getByLabel('Expiration year').selectOption(expYear)
  await page.getByLabel('Security code (CVV)').fill('123')
  await page.getByRole('button', { name: 'Add your card' }).click()
}

try {
  step('guest adds two items from product pages')
  await addFromProductPage(1, 1)
  await addFromProductPage(3, 2)

  step('cart: quantity up, save for later + undo, save again, move back to cart')
  await page.goto(`${base}/cart`)
  await page.getByRole('heading', { name: 'Shopping Cart' }).waitFor()
  await page.getByText('Subtotal (2 items)').first().waitFor()
  await page.getByRole('button', { name: /^Increase quantity of / }).first().click()
  await page.getByText('Subtotal (3 items)').first().waitFor()
  await waitCart(3)
  await page.getByRole('button', { name: 'Save for later' }).last().click()
  await page.getByRole('heading', { name: 'Saved for later (1 item)' }).waitFor()
  await page.getByText('Subtotal (2 items)').first().waitFor()
  await page.getByRole('button', { name: 'Undo' }).click()
  await page.getByRole('heading', { name: 'Saved for later (1 item)' }).waitFor({ state: 'detached' })
  await page.getByText('Subtotal (3 items)').first().waitFor()
  await page.getByRole('button', { name: 'Save for later' }).last().click()
  await page.getByRole('button', { name: 'Move to cart' }).click()
  await page.getByRole('heading', { name: /Saved for later/ }).waitFor({ state: 'detached' })
  await page.getByText('Subtotal (3 items)').first().waitFor()

  step('proceed to checkout asks to sign in; create an account and come back')
  await page.getByRole('link', { name: 'Proceed to checkout' }).click()
  await page.waitForURL(`${base}/ap/signin?return_to=%2Fcheckout`)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Your name').fill('Eve Tester')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Re-enter password').fill(password)
  await page.getByRole('button', { name: 'Create your nile account' }).click()
  await page.waitForURL(`${base}/checkout`)
  assert.equal(await summary().getByText(/^Items \(/).textContent(), 'Items (3):')
  assert.equal(await page.getByRole('button', { name: 'Place your order' }).first().isDisabled(), true)

  step('address: ZIP/state mismatch first, then saved')
  await page.getByLabel('Full name (First and Last name)').fill('Eve Tester')
  await page.getByLabel('Phone number').fill('(206) 555-0100')
  await page.getByLabel('Address', { exact: true }).fill('410 Terry Ave N')
  await page.getByLabel('City').fill('Seattle')
  await page.getByLabel('State', { exact: true }).selectOption('WA')
  await page.getByLabel('ZIP Code').fill('10001')
  await page.getByRole('button', { name: 'Use this address' }).click()
  await page.getByText("The ZIP code you entered doesn't match the state.").waitFor()
  assert.equal(await page.getByLabel('City').inputValue(), 'Seattle')
  await page.getByLabel('ZIP Code').fill('98109')
  await page.getByRole('button', { name: 'Use this address' }).click()
  await page.getByRole('heading', { name: 'Delivering to Eve Tester' }).waitFor()

  step('card: bad number, then a real-looking (non-test) number, then the test card button')
  assert.equal(await page.getByLabel('Name on card').inputValue(), 'Eve Tester')
  await addCard('4242 4242 4242 4241')
  await page.getByText('Please enter a valid card number.').waitFor()
  await addCard('4111 1111 1111 1111')
  await page.getByText('This is a demo store: use a test card such as 4242 4242 4242 4242.').waitFor()
  await page.getByRole('button', { name: 'Use test card' }).click()
  await page.getByRole('button', { name: 'Add your card' }).click()
  await page.getByRole('heading', { name: 'Paying with Visa ending in 4242' }).waitFor()

  step('review: change a quantity in place')
  await page.locator('select[aria-label^="Quantity of"]:has(option[value="2"]:checked)').selectOption('1')
  await summary().getByText('Items (2):').waitFor()

  step('expedited delivery changes shipping and total')
  const standardTotal = await amount('Order total:')
  await page.getByLabel(/Expedited Delivery/).check()
  assert.equal(await amount('Shipping & handling:'), 9.99)
  assert.notEqual(await amount('Order total:'), standardTotal)

  step('place the order; thank-you page shows it; refresh does not re-order')
  await page.getByRole('button', { name: 'Place your order' }).first().click()
  await page.waitForURL(/\/thankyou\/113-\d{7}-\d{7}$/)
  const orderId = new URL(page.url()).pathname.split('/').pop()
  await page.getByRole('heading', { name: 'Order placed, thanks!' }).waitFor()
  await page.getByText(orderId, { exact: true }).waitFor()
  await page.getByText('Shipping to Eve Tester,').waitFor()
  await page.getByText('Expedited Delivery').waitFor()
  assert.equal(await cartLabel(), 'Cart, 0 items')
  await page.reload()
  await page.getByText(orderId, { exact: true }).waitFor()

  step('Back to the placed checkout cannot place it again')
  await page.goBack()
  await Promise.race([page.getByRole('heading', { name: 'You already placed this order' }).waitFor(), page.waitForURL(`${base}/cart`)])
  await page.goto(`${base}/thankyou/${orderId}`)

  step('cart is empty and checkout sends you back to it')
  await page.goto(`${base}/cart`)
  await page.getByRole('heading', { name: 'Your nile Cart is empty' }).waitFor()
  await page.goto(`${base}/checkout`)
  await page.waitForURL(`${base}/cart`)

  step('buy now from a product page: only that item, declined card, then pay; cart untouched')
  await addFromProductPage(1, 1)
  await page.goto(`${base}/dp/5`)
  await page.getByRole('link', { name: 'Buy Now' }).click()
  await page.waitForURL(`${base}/checkout?buy=5&qty=1`)
  await page.getByText('Buying now: the items in your cart are not affected.').waitFor()
  assert.equal(await summary().getByText(/^Items \(/).textContent(), 'Items (1):')
  await page.getByRole('button', { name: 'Change payment method' }).click()
  await page.getByRole('button', { name: '+ Add a credit or debit card' }).click()
  await addCard('4000 0000 0000 0002')
  await page.getByRole('heading', { name: 'Paying with Visa ending in 0002' }).waitFor()
  await page.getByRole('button', { name: 'Place your order' }).first().click()
  await page.getByText(/Your card was declined/).waitFor()
  await page.getByRole('button', { name: 'Change payment method' }).click()
  await page.getByLabel(/Visa ending in 4242/).check()
  await page.getByRole('button', { name: 'Use this payment method' }).click()
  await page.getByRole('button', { name: 'Place your order' }).first().click()
  await page.waitForURL(/\/thankyou\/113-/)
  await page.getByRole('link', { name: 'Red Nail Polish' }).waitFor()
  assert.equal(await cartLabel(), 'Cart, 1 item')

  step('unknown buy-now id shows a friendly message')
  await page.goto(`${base}/checkout?buy=999999`)
  await page.getByRole('heading', { name: "We couldn't find that item." }).waitFor()

  step('390px wide: cart and checkout fit without horizontal scrolling')
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/cart', '/checkout?buy=5&qty=1']) {
    await page.goto(base + path)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} overflows at 390px`)
  }

  console.log('e2e checkout ok')
} catch (e) {
  await page.screenshot({ path: 'e2e/checkout-failure.png', fullPage: true }).catch(() => {})
  console.error(`failed at ${page.url()} (screenshot: e2e/checkout-failure.png)`)
  throw e
} finally {
  await browser.close()
}
