// Group buy end to end in headless Chrome: join an open group, confirm an unfilled group still charges the shelf price,
// fill it with the demo control, then see the team price in the cart and at checkout.
// Run with the app up: node e2e/group-buy.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const email = `group-${Date.now()}@example.com`
const password = 'secret123'
const PRODUCT = 138 // Baseball Ball: a seeded slow mover (lib/group-buy picks the highest-stock products)

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
// US dollars wherever this runs from, so the amounts below are the ones on screen
await page.context().addCookies([{ name: 'currency', value: 'USD', url: base }, { name: 'ship_country', value: 'US', url: base }])
const step = (name) => console.log(`- ${name}`)
const dollars = (text) => Number(text.match(/\$([\d,]+\.\d{2})/)[1].replace(/,/g, ''))
const panel = () => page.getByRole('region', { name: 'Group buy' })
// "2 of 3 joined · 1 more to unlock" while it fills, "6 joined · unlocked at 3" once it has
const joinedCount = async () => {
  const text = await panel().innerText() // the count is split across elements, so read the whole panel
  const m = text.match(/(\d+) of (\d+) joined/) ?? text.match(/(\d+) joined · unlocked at (\d+)/)
  return [Number(m[1]), Number(m[2])]
}
// what the shopper would pay, from the lock control's copy ("Hold $8.99 while you decide")
const offeredPrice = async () => dollars(await page.getByText(/^Hold \$/).textContent())

try {
  step('sign up, then open a product carrying a group buy')
  await page.goto(`${base}/ap/signin?return_to=${encodeURIComponent(`/dp/${PRODUCT}`)}`)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Your name').fill('Group Tester')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Re-enter password').fill(password)
  await page.getByRole('button', { name: 'Create your nile account' }).click()
  await panel().waitFor()
  const teamPrice = dollars(await panel().getByRole('heading').textContent())
  const shelf = await offeredPrice()
  assert.ok(teamPrice < shelf, `team price ${teamPrice} is under the shelf price ${shelf}`)
  const [, target] = await joinedCount()
  assert.ok(target >= 3, 'a group needs a few committed buyers')

  step('joining moves the counter and offers a link to share')
  // groups are shared and persist, so an earlier run may have filled this one: assert the rule in whichever state it is in
  const [before] = await joinedCount()
  const wasFilled = before >= target
  await panel().getByRole('button', { name: 'Join this group buy' }).click()
  await panel().getByText("You're in").waitFor()
  const [after] = await joinedCount()
  assert.equal(after, before + 1, 'the count is the members table, not a guess')
  const share = await panel().getByLabel('Link to share this group buy').inputValue()
  assert.match(share, new RegExp(`/dp/${PRODUCT}\\?g=[0-9a-f-]{36}$`))

  if (!wasFilled) {
    step('an unfilled group still charges the shelf price')
    assert.equal(await offeredPrice(), shelf, 'joining alone changes nothing')
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
    await page.goto(`${base}/cart`)
    await page.getByText(`Subtotal (1 item): $${shelf.toFixed(2)}`).first().waitFor()

    step('the demo fill unlocks the team price')
    await page.goto(`${base}/dp/${PRODUCT}`)
    await panel().getByRole('button', { name: 'Demo: fill this group' }).click()
  } else {
    step(`the group was already full (${before} of ${target}), so joining unlocks the price at once`)
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
    await page.goto(`${base}/dp/${PRODUCT}`)
  }
  await panel().getByText(/Group price unlocked/).waitFor()
  const [filled, need] = await joinedCount()
  assert.ok(filled >= need, `${filled} of ${need} joined`)
  assert.equal(await offeredPrice(), teamPrice, 'the product page now offers the team price')
  assert.equal(await panel().getByRole('button', { name: 'Leave this group' }).count(), 0, 'a filled group cannot be left')

  step('the cart and checkout charge the team price')
  await page.goto(`${base}/cart`)
  await page.getByText(`Subtotal (1 item): $${teamPrice.toFixed(2)}`).first().waitFor()
  await page.getByRole('link', { name: 'Proceed to checkout' }).click()
  await page.waitForURL(`${base}/checkout`)
  await page.getByLabel('Full name (First and Last name)').fill('Group Tester')
  await page.getByLabel('Phone number').fill('(206) 555-0100')
  await page.getByLabel('Address', { exact: true }).fill('410 Terry Ave N')
  await page.getByLabel('City').fill('Seattle')
  await page.getByLabel('Country/Region').selectOption('US')
  await page.getByLabel('State', { exact: true }).selectOption('WA')
  await page.getByLabel('ZIP Code').fill('98109')
  await page.getByRole('button', { name: 'Use this address' }).click()
  await page.getByRole('heading', { name: 'Delivering to Group Tester' }).waitFor()
  await page.getByRole('button', { name: 'Use test card' }).click()
  await page.getByRole('button', { name: 'Add your card' }).click()
  await page.getByRole('heading', { name: 'Paying with Visa ending in 4242' }).waitFor()
  const summary = page.getByRole('complementary', { name: 'Order summary' })
  const items = await summary.locator('dl > div').filter({ hasText: 'Items (1):' }).locator('dd').textContent()
  assert.equal(dollars(items), teamPrice, 'checkout charges the team price')

  step('390px: the panel fits without sideways scroll')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${base}/dp/${PRODUCT}`)
  await panel().waitFor()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390)

  console.log('group buy e2e passed')
} catch (e) {
  await page.screenshot({ path: 'e2e/group-buy-failure.png' }).catch(() => {})
  console.error(e)
  process.exitCode = 1
} finally {
  await browser.close()
}
