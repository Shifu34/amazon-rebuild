// Restock reminders end to end in headless Chrome: the control appears only on delivered consumables, setting one shows
// on Your Account, changing the interval moves the date, the demo control sends it (closing the row), and cancel removes it.
// Run with the app up: node e2e/reminders.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const GROCERY = 31 // Lemon (groceries): a consumable, default 3 weeks
const SHOES = 90 // Men's shoes: nothing to run out of

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
// US dollars wherever the test runs from (the live site picks rupees for a Pakistani IP)
await page.context().addCookies([{ name: 'currency', value: 'USD', url: base }, { name: 'ship_country', value: 'US', url: base }])
const step = (name) => console.log(`- ${name}`)
const S = '/private/tmp/claude-501/-Users-mikey-Desktop-8x/d33e7375-9310-44d1-a031-01d9ad53c013/scratchpad'
const reminders = () => page.getByRole('region', { name: 'Restock reminders' })
const waitCart = (n) =>
  page.waitForFunction((n) => document.querySelector('a[aria-label^="Cart, "]')?.getAttribute('aria-label') === `Cart, ${n} ${n === 1 ? 'item' : 'items'}`, n)

try {
  step('sign up, buy a consumable and a non-consumable, deliver the order')
  await page.goto(`${base}/dp/${GROCERY}`)
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
  await waitCart(1)
  await page.goto(`${base}/dp/${SHOES}`)
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
  await waitCart(2)
  await page.goto(`${base}/checkout`)
  await page.waitForURL(/\/ap\/signin\?/)
  await page.getByLabel('Email').fill(`reminders-${Date.now()}@example.com`)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Your name').fill('Remy Restock')
  await page.getByLabel('Password', { exact: true }).fill('secret123')
  await page.getByLabel('Re-enter password').fill('secret123')
  await page.getByRole('button', { name: 'Create your nile account' }).click()
  await page.waitForURL(`${base}/checkout`)
  await page.getByLabel('Full name (First and Last name)').fill('Remy Restock')
  await page.getByLabel('Phone number').fill('(206) 555-0100')
  await page.getByLabel('Address', { exact: true }).fill('410 Terry Ave N')
  await page.getByLabel('City').fill('Seattle')
  await page.getByLabel('Country/Region').selectOption('US')
  await page.getByLabel('State', { exact: true }).selectOption('WA')
  await page.getByLabel('ZIP Code').fill('98109')
  await page.getByRole('button', { name: 'Use this address' }).click()
  await page.getByRole('heading', { name: 'Delivering to Remy Restock' }).waitFor()
  await page.getByRole('button', { name: 'Use test card' }).click()
  await page.getByRole('button', { name: 'Add your card' }).click()
  await page.getByRole('heading', { name: 'Paying with Visa ending in 4242' }).waitFor()
  await page.getByRole('button', { name: 'Place your order' }).first().click()
  await page.waitForURL(/\/thankyou\/113-\d{7}-\d{7}$/)
  const orderId = new URL(page.url()).pathname.split('/').pop()

  step('before delivery there is no reminder; after it, only the consumable offers one')
  await page.goto(`${base}/orders/${orderId}`)
  assert.equal(await page.getByRole('button', { name: 'Remind me' }).count(), 0, 'nothing to restock before it arrives')
  await page.getByRole('button', { name: 'Demo: mark as delivered' }).click()
  await page.getByRole('heading', { name: 'Delivered today' }).waitFor()
  const offers = page.getByText('Remind me when this runs out')
  assert.equal(await offers.count(), 1, 'the grocery line offers a reminder, the shoes do not')
  await page.getByText('No subscription, no card charged').first().waitFor()
  await page.locator('#main').screenshot({ path: `${S}/reminder-order-1280.png` }).catch(() => {})

  step('set it: the line confirms the date and Your Account lists it')
  await page.getByRole('button', { name: 'Remind me' }).click()
  await page.getByText(/^Reminder set for /).waitFor()
  await page.goto(`${base}/account`)
  const row = reminders().getByRole('listitem').first()
  await row.getByText(/^Due /).waitFor()
  const firstDue = await row.getByText(/^Due /).textContent()
  await page.screenshot({ path: `${S}/reminder-account-1280.png`, fullPage: false })

  step('changing the interval moves the date out')
  await row.getByLabel('Remind me in').selectOption('12')
  await row.getByRole('button', { name: 'Change' }).click()
  await page.waitForFunction((was) => document.querySelector('[aria-labelledby="reminders-heading"] li p:last-child')?.textContent !== was, firstDue)
  const laterDue = await reminders().getByRole('listitem').first().getByText(/^Due /).textContent()
  assert.notEqual(laterDue, firstDue, '12 weeks is further out than 3')
  assert.ok(new Date(laterDue.replace('Due ', '')) > new Date(firstDue.replace('Due ', '')), `${laterDue} is after ${firstDue}`)

  step('the demo control sends what is due, which closes the reminder')
  await page.getByRole('button', { name: 'Demo: send due reminders now' }).click()
  await reminders().getByText('You have no reminders set.').waitFor()

  step('set it again from the order, then cancel it')
  await page.goto(`${base}/orders/${orderId}`)
  await page.getByRole('button', { name: 'Remind me' }).click()
  await page.getByText(/^Reminder set for /).waitFor()
  await page.getByRole('button', { name: 'Cancel reminder' }).click()
  await page.getByText('Remind me when this runs out').waitFor()
  await page.goto(`${base}/account`)
  await reminders().getByText('You have no reminders set.').waitFor()

  step('390px: the control and the account section fit')
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: await page.context().storageState() })
  const small = await phone.newPage()
  await small.goto(`${base}/orders/${orderId}`)
  await small.getByText('Remind me when this runs out').waitFor()
  await small.screenshot({ path: `${S}/reminder-order-390.png`, fullPage: false })
  await small.goto(`${base}/account`)
  await small.getByRole('region', { name: 'Restock reminders' }).waitFor()
  await small.screenshot({ path: `${S}/reminder-account-390.png`, fullPage: false })
  assert.equal(await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'no sideways scroll')
  await phone.close()

  console.log('reminders e2e passed')
} catch (e) {
  await page.screenshot({ path: 'e2e/reminders-failure.png' }).catch(() => {})
  console.error(e)
  process.exitCode = 1
} finally {
  await browser.close()
}
