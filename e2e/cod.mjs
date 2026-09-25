// Cash on delivery end to end in headless Chrome: place a cash order with no card at all, confirm it, take delivery, then
// refuse the next one and watch the shopper's own standing ask for part of the total up front.
// Run with the app up: node e2e/cod.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const email = `cod-${Date.now()}@example.com`
const password = 'secret123'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
// US dollars wherever this runs from, so the amounts below are the ones on screen
await page.context().addCookies([{ name: 'currency', value: 'USD', url: base }, { name: 'ship_country', value: 'US', url: base }])
const step = (name) => console.log(`- ${name}`)
const shot = (name) => page.screenshot({ path: `${process.env.SHOTS ?? 'e2e'}/${name}.png` })

// cart → checkout, choosing cash; the address is only asked for the first time
async function cashCheckout({ address = false } = {}) {
  await page.goto(`${base}/dp/1`)
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
  await page.getByRole('link', { name: /^Cart, [1-9]/ }).waitFor() // the add landed before we leave the page
  await page.goto(`${base}/checkout`)
  if (address) {
    await page.getByLabel('Full name (First and Last name)').fill('Cash Tester')
    await page.getByLabel('Phone number').fill('(206) 555-0100')
    await page.getByLabel('Address', { exact: true }).fill('410 Terry Ave N')
    await page.getByLabel('City').fill('Seattle')
    await page.getByLabel('Country/Region').selectOption('US')
    await page.getByLabel('State', { exact: true }).selectOption('WA')
    await page.getByLabel('ZIP Code').fill('98109')
    await page.getByRole('button', { name: 'Use this address' }).click()
    await page.getByRole('heading', { name: 'Delivering to Cash Tester' }).waitFor()
  }
  // a first-time shopper gets the card form (with a way out to cash); afterwards cash is a row in the payment list
  const straightToCash = page.getByRole('button', { name: 'Pay with Cash on Delivery instead' })
  if (await straightToCash.isVisible()) {
    await straightToCash.click()
  } else {
    const cash = page.getByRole('radio', { name: /Cash on Delivery/ })
    if (!(await cash.isVisible())) await page.getByRole('button', { name: 'Change payment method' }).click()
    await cash.check()
    await page.getByRole('button', { name: 'Use this payment method' }).click()
  }
  await page.getByRole('heading', { name: 'Paying with Cash on Delivery' }).waitFor()
}

async function placeOrder() {
  await page.getByRole('button', { name: 'Place your order' }).first().click()
  await page.waitForURL(/\/thankyou\/113-\d{7}-\d{7}$/)
  const id = new URL(page.url()).pathname.split('/').pop()
  await page.goto(`${base}/orders/${id}`)
  return id
}

try {
  step('sign up, then check out with cash and no card on the account')
  await page.goto(`${base}/ap/signin?return_to=${encodeURIComponent('/dp/1')}`)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Your name').fill('Cash Tester')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Re-enter password').fill(password)
  await page.getByRole('button', { name: 'Create your nile account' }).click()
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().waitFor() // signed in, back on the product
  await cashCheckout({ address: true })
  await shot('cod-checkout-1280')
  // nothing blocks the order: a shopper in good standing needs no card at all
  assert.equal(await page.getByText('Add a payment method to continue.').count(), 0, 'cash satisfies payment')
  const first = await placeOrder()

  step('the order waits for one confirmation before it ships')
  const confirm = page.getByRole('button', { name: 'Confirm this order' })
  await page.getByRole('heading', { name: 'Awaiting your confirmation' }).waitFor()
  await page.getByText('Cash on Delivery', { exact: true }).first().waitFor() // the payment method, not a card
  await shot('cod-unconfirmed-1280')
  await confirm.click()
  await confirm.waitFor({ state: 'detached' })

  step('taking delivery keeps cash open, with nothing up front')
  await page.getByRole('button', { name: 'Demo: mark as delivered' }).click()
  await page.getByText(/Delivered/).first().waitFor()
  await page.goto(`${base}/account`)
  await page.getByRole('heading', { name: 'Cash on delivery: open' }).waitFor()
  await page.getByText("You've taken 1 parcel paid in cash").waitFor()

  step('refusing the next parcel changes the standing, and nothing is charged')
  await cashCheckout()
  const refused = await placeOrder()
  await page.getByRole('button', { name: 'Confirm this order' }).click()
  await page.getByRole('button', { name: 'Demo: refuse delivery' }).click()
  await page.getByRole('heading', { name: 'Parcel refused' }).waitFor()
  await page.getByText('Nothing was charged.', { exact: false }).waitFor()
  assert.notEqual(first, refused)

  step('Your Account explains the new terms in plain words')
  await page.goto(`${base}/account`)
  await page.getByRole('heading', { name: 'Cash on delivery: 30% up front' }).waitFor()
  await page.getByText('A parcel was refused, so we ask for 30% up front on cash orders.').waitFor()
  await shot('cod-account-1280')

  step('checkout now asks for a card for the advance, and says why')
  await page.goto(`${base}/dp/1`)
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
  await page.getByRole('link', { name: /^Cart, [1-9]/ }).waitFor()
  await page.goto(`${base}/checkout`)
  // no card on the account, so the card form is what they see: it now says why one is needed
  await page.getByText('A parcel was refused, so we ask for 30% up front on cash orders.').waitFor()
  await page.getByRole('button', { name: 'Pay with Cash on Delivery instead' }).click()
  await page.getByText('Add a card for the 30% we take up front on cash orders.').first().waitFor()
  assert.equal(await page.getByRole('button', { name: 'Place your order' }).first().isDisabled(), true, 'no card, no cash order')

  console.log('cod e2e passed')
} catch (e) {
  await page.screenshot({ path: 'e2e/cod-failure.png' }).catch(() => {})
  console.error(e)
  process.exitCode = 1
} finally {
  await browser.close()
}
