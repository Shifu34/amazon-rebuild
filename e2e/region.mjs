// A Pakistan shopper end to end in headless Chrome: a guest from a Pakistani IP sees "Deliver to Pakistan" and PKR on home,
// search and a product page; switches to USD and back in the EN menu; signs up, checks out to a Pakistani address (field
// errors first), sees international options, no tax and the import-fees note with totals that add up; the placed order
// stays in PKR on the thank-you page, Your Orders, details and invoice even after switching to USD; then a default US
// address brings US rules (FREE over $35, 8.25% tax) in the display currency. Ends with 390px overflow checks.
// Run with the app up: node e2e/region.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const NOTE = 'Import duty is estimated and included, so the courier collects nothing on delivery.'
const PKR = /^PKR [\d,]+\.\d{2}$/
const USD = /^\$[\d,]+\.\d{2}$/

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-vercel-ip-country': 'PK' } })
const page = await context.newPage()
const step = (name) => console.log(`- ${name}`)
const main = page.locator('#main')
const header = page.locator('header')
const waitCart = (n) =>
  page.waitForFunction((n) => document.querySelector('a[aria-label^="Cart, "]')?.getAttribute('aria-label') === `Cart, ${n} ${n === 1 ? 'item' : 'items'}`, n)
// "PKR 1,234.56" / "-$6.99" / "−PKR 1.00" → signed minor units
const minor = (t) => (/^[−-]/.test(t.trim()) ? -1 : 1) * Math.round(Number(t.replace(/[^\d.]/g, '')) * 100)
// the rows of a <dl> of label/amount pairs as { label: text }
const rows = (dl) =>
  dl.locator('dl > div').evaluateAll((divs) => Object.fromEntries(divs.filter((d) => d.querySelector('dt') && d.querySelector('dd')).map((d) => [d.querySelector('dt').textContent.trim(), d.querySelector('dd').textContent.trim()])))
const summary = () => page.getByRole('complementary', { name: 'Order summary' })
const review = () => page.getByRole('region', { name: 'Review items and delivery' })
const noDollarsIn = async (where) => assert.ok(!/\$\s?\d/.test(await where.innerText()), `no $ amounts on ${page.url()}`)

// the EN menu's currency radios apply on change and re-render the page
async function chooseCurrency(label) {
  const en = page.getByRole('button', { name: 'EN: language and currency' })
  await en.click()
  const panel = page.locator(`[id="${await en.getAttribute('aria-controls')}"]`)
  await panel.getByRole('radio', { name: label }).check()
  await page.locator('footer').getByText(label.replace(/^\$ - /, '')).waitFor()
}

try {
  step('guest from a Pakistani IP: home says Deliver to Pakistan and prices are in PKR')
  await page.goto(base)
  await header.getByRole('button', { name: /^Deliver to Pakistan/ }).waitFor()
  await main.getByText(PKR).first().waitFor({ state: 'attached' })
  await noDollarsIn(main)
  await page.locator('footer').getByText('PKR - Pakistani Rupee').waitFor()

  step('help: the Pakistan FAQ gives the delivery fees in rupees, no $ amounts')
  await page.goto(`${base}/help`)
  const help = await main.textContent()
  assert.ok(help.includes('flat PKR 4,153.28') && help.includes('Expedited for PKR 8,309.33'), 'FAQ fees in PKR')
  assert.ok(!/\$\s?\d/.test(help), 'no $ amounts on /help in PKR')

  step('search: PKR prices and the international delivery fee on the cards')
  await page.goto(`${base}/s?k=perfume`)
  await main.getByText(PKR).first().waitFor({ state: 'attached' })
  await main.getByText(/PKR 4,153\.28 delivery/).first().waitFor()
  assert.equal(await main.getByText(/FREE delivery/).count(), 0, 'never free to Pakistan')
  await noDollarsIn(main)

  step('typed rupee prices keep their decimals, and the results stay inside the bounds shown ($9.99 shows PKR 2,767.93)')
  const shownPrices = async () => (await main.locator('article').evaluateAll((cards) => cards.map((c) => c.querySelector('.sr-only').textContent))).map(minor)
  const priceFilters = page.getByRole('complementary', { name: 'Filters' })
  await page.goto(`${base}/s?i=beauty-personal-care`)
  await priceFilters.getByLabel('Minimum price, in Pakistani Rupees').fill('2767.5')
  await priceFilters.getByLabel('Maximum price, in Pakistani Rupees').fill('5000')
  await priceFilters.getByRole('button', { name: 'Go' }).click()
  await page.waitForURL(/min=2767\.5&max=5000&cur=PKR/)
  await page.getByRole('link', { name: 'Remove filter: PKR 2,767.50 to 5,000' }).waitFor()
  assert.equal(await priceFilters.getByLabel('Minimum price, in Pakistani Rupees').inputValue(), '2767.5', 'the box keeps the decimals')
  const between = await shownPrices()
  assert.ok(between.includes(276793) && between.every((m) => m >= 276750 && m <= 500000), `PKR 2,767.50 to 5,000: ${between}`)
  for (const [max, in9_99] of [['2767.92', false], ['2767.93', true]]) {
    await page.goto(`${base}/s?i=beauty-personal-care&max=${max}&cur=PKR`)
    await page.getByRole('link', { name: `Remove filter: Up to PKR ${max.replace('2767', '2,767')}` }).waitFor()
    const under = await shownPrices()
    assert.ok(under.length && under.every((m) => m <= Math.round(Number(max) * 100)), `up to PKR ${max}: ${under}`)
    assert.equal(under.includes(276793), in9_99, `PKR 2,767.93 ${in9_99 ? 'is' : 'is not'} up to PKR ${max}`)
  }

  step('product page: PKR price, Deliver to Pakistan, Ships to Pakistan, import fees, no countdown')
  await page.goto(`${base}/dp/6`) // Calvin Klein CK One, $49.99
  await main.getByText('PKR 13,850.73').first().waitFor({ state: 'attached' })
  await main.getByRole('button', { name: 'Deliver to Pakistan' }).waitFor()
  await main.getByText('Ships to Pakistan').waitFor()
  await main.getByText(NOTE).first().waitFor()
  await main.getByText(/PKR 4,153\.28 delivery/).first().waitFor()
  assert.equal(await main.getByText('Order within').count(), 0)

  step('EN menu: USD turns prices to dollars, PKR brings rupees back')
  await chooseCurrency('$ - USD - US Dollar')
  await main.getByText('$49.99').first().waitFor({ state: 'attached' })
  await main.getByText(/\$14\.99 delivery/).first().waitFor()
  assert.equal(await main.getByText('PKR 13,850.73').count(), 0)
  await chooseCurrency('PKR - Pakistani Rupee')
  await main.getByText('PKR 13,850.73').first().waitFor({ state: 'attached' })

  step('create an account, add two items to the cart and go to checkout')
  await page.goto(`${base}/ap/signin`)
  await page.getByLabel('Email').fill(`region-${Date.now()}@example.com`)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Your name').fill('Ayesha Khan')
  await page.getByLabel('Password', { exact: true }).fill('secret123')
  await page.getByLabel('Re-enter password').fill('secret123')
  await page.getByRole('button', { name: 'Create your nile account' }).click()
  await page.getByText('Hello, Ayesha').waitFor()
  for (const [id, n] of [[6, 1], [1, 2]]) {
    await page.goto(`${base}/dp/${id}`)
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
    await waitCart(n)
  }
  await page.goto(`${base}/cart`)
  await page.getByText(/Subtotal \(2 items\): PKR [\d,]+\.\d{2}/).first().waitFor()
  await page.getByRole('link', { name: 'Proceed to checkout' }).click()
  await page.waitForURL(`${base}/checkout`)

  step('Pakistan address: wrong first (no province, 4-digit postal code, bad phone), each field says why')
  assert.equal(await page.getByLabel('Country/Region').inputValue(), 'PK', 'a new address starts in the delivery country')
  await page.getByLabel('Full name (First and Last name)').fill('Ayesha Khan')
  await page.getByLabel('Phone number').fill('12345')
  await page.getByLabel('Address', { exact: true }).fill('12 Mall Road')
  await page.getByLabel('City').fill('Lahore')
  await page.getByLabel('Postal Code').fill('5400')
  await page.getByRole('button', { name: 'Use this address' }).click()
  await page.getByText('Please enter a state, region or province.').waitFor()
  await page.getByText('Please enter a valid postal code.').waitFor()
  await page.getByText('Please enter a valid phone number.').waitFor()
  await page.getByText('Please correct the 3 highlighted fields below.').waitFor()
  assert.equal(await page.getByLabel('City').inputValue(), 'Lahore', 'typed values survive the errors')

  step('then a valid one: Lahore, Punjab 54000, 0300 1234567')
  await page.getByLabel('Province/Territory').selectOption('PB')
  await page.getByLabel('Postal Code').fill('54000')
  await page.getByLabel('Phone number').fill('0300 1234567')
  await page.getByRole('button', { name: 'Use this address' }).click()
  await page.getByRole('heading', { name: 'Delivering to Ayesha Khan' }).waitFor()
  await page.getByText('12 Mall Road, Lahore, Punjab 54000, Pakistan').waitFor()
  await page.getByRole('button', { name: 'Use test card' }).click()
  await page.getByRole('button', { name: 'Add your card' }).click()
  await page.getByRole('heading', { name: 'Paying with Visa ending in 4242' }).waitFor()

  step('checkout: International Standard and Expedited with dates and PKR fees, no tax line, import-fees note, totals add up')
  const date = '[A-Z][a-z]+day, [A-Z][a-z]+ \\d{1,2}'
  const standard = review().getByLabel(new RegExp(`${date}\\s*PKR 4,153\\.28 Standard International Delivery`))
  const expedited = review().getByLabel(new RegExp(`${date}\\s*PKR 8,309\\.33 Expedited International Delivery`))
  await standard.waitFor()
  await expedited.waitFor()
  assert.ok(await standard.isChecked())
  await summary().getByText(NOTE).waitFor()
  const std = await rows(summary())
  assert.deepEqual(Object.keys(std), ['Items (2):', 'Shipping & handling:', 'Import duty (estimated):', 'Order total:'], `duty, no tax: ${JSON.stringify(std)}`)
  assert.equal(std['Shipping & handling:'], 'PKR 4,153.28')
  for (const v of Object.values(std)) assert.match(v, PKR)
  assert.equal(minor(std['Order total:']), minor(std['Items (2):']) + minor(std['Shipping & handling:']) + minor(std['Import duty (estimated):']), 'standard total adds up')

  step('switching to Expedited changes shipping and the total')
  await expedited.check()
  await summary().getByText('PKR 8,309.33').waitFor()
  const exp = await rows(summary())
  assert.notEqual(exp['Order total:'], std['Order total:'])
  assert.equal(minor(exp['Order total:']), minor(exp['Items (2):']) + minor(exp['Shipping & handling:']) + minor(exp['Import duty (estimated):']), 'expedited total adds up')

  step('place the order: the thank-you page shows PKR')
  await page.getByRole('button', { name: 'Place your order' }).first().click()
  await page.waitForURL(/\/thankyou\/113-\d{7}-\d{7}$/)
  const orderId = new URL(page.url()).pathname.split('/').pop()
  await page.getByRole('heading', { name: 'Order placed, thanks!' }).waitFor()
  const details = page.getByRole('complementary', { name: 'Order details' })
  await details.getByText(NOTE).waitFor()
  await page.getByText('Expedited International Delivery').first().waitFor()
  const thanks = await rows(details)
  assert.equal(thanks['Order total:'], exp['Order total:'], 'the thank-you total is what checkout showed')
  const total = exp['Order total:']

  const orderPagesInPkr = async (label) => {
    await page.goto(`${base}/orders`)
    await page.getByRole('article', { name: `Order ${orderId}` }).getByText(total, { exact: true }).waitFor()
    await page.goto(`${base}/orders/${orderId}`)
    const r = await rows(page.getByRole('region', { name: 'Order summary' }))
    assert.equal(r['Grand Total:'], total, `details Grand Total ${label}`)
    assert.equal(minor(r['Grand Total:']), minor(r['Item(s) Subtotal:']) + minor(r['Shipping & Handling:']) + minor(r['Import duty (estimated):']), `details add up ${label}`)
    assert.equal(r['Estimated tax to be collected:'], undefined)
    await page.getByRole('region', { name: 'Order summary' }).getByText(NOTE).waitFor()
    await page.goto(`${base}/orders/${orderId}/invoice`)
    await page.getByText(`Order Total: ${total}`).waitFor()
    await main.getByText('Expedited International Delivery').waitFor() // Shipping Speed, as checkout named it
    await noDollarsIn(main)
  }

  step('Your Orders, details and invoice show PKR')
  await orderPagesInPkr('in PKR')

  step('2 × Lemon (PKR 218.89): the unit price × 2 is the subtotal on the added sheet, cart, checkout, thank-you and invoice')
  const lemons = 'PKR 437.78' // not $1.58 converted (437.77)
  await page.goto(`${base}/dp/31`)
  await page.getByLabel('Quantity').selectOption('2')
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
  await waitCart(2)
  await page.getByRole('dialog', { name: 'Added to cart' }).getByText(lemons).waitFor()
  await page.goto(`${base}/cart`)
  await page.getByText(`Subtotal (2 items): ${lemons}`).first().waitFor()
  await page.getByRole('link', { name: 'Proceed to checkout' }).click()
  await page.waitForURL(`${base}/checkout`)
  await review().getByText('PKR 218.89').first().waitFor()
  assert.equal((await rows(summary()))['Items (2):'], lemons)
  await page.getByRole('button', { name: 'Place your order' }).first().click()
  await page.waitForURL(/\/thankyou\/113-\d{7}-\d{7}$/)
  const lemonOrder = new URL(page.url()).pathname.split('/').pop()
  assert.equal((await rows(details))['Items (2):'], lemons)
  await page.goto(`${base}/orders/${lemonOrder}/invoice`)
  await main.getByText('2 of: Lemon').waitFor()
  assert.equal((await rows(main))['Item(s) Subtotal:'], lemons)
  await main.getByText('Standard International Delivery').waitFor()

  step('switch the display to USD: the order pages keep PKR, product prices elsewhere are in $')
  await page.goto(`${base}/dp/6`)
  await chooseCurrency('$ - USD - US Dollar')
  await main.getByText('$49.99').first().waitFor({ state: 'attached' })
  await orderPagesInPkr('after switching to USD')
  await page.goto(`${base}/s?k=perfume`)
  await main.getByText(USD).first().waitFor({ state: 'attached' })
  await main.getByText(/\$14\.99 delivery/).first().waitFor() // still delivering to the Pakistani default address

  step('add a US address and make it the default: the header shows it')
  await page.goto(`${base}/account/addresses/new`)
  await page.getByLabel('Country/Region').selectOption('US')
  await page.getByLabel('Full name (First and Last name)').fill('Eve Tester')
  await page.getByLabel('Phone number').fill('(206) 555-0100')
  await page.getByLabel('Address', { exact: true }).fill('410 Terry Ave N')
  await page.getByLabel('City').fill('Seattle')
  await page.getByLabel('State', { exact: true }).selectOption('WA')
  await page.getByLabel('ZIP Code').fill('98109')
  // a US phone is wrong for Pakistan; switching back to the US must not keep that error (or the banner) on screen
  await page.getByLabel('Country/Region').selectOption('PK')
  await page.getByRole('button', { name: 'Add address' }).click()
  await page.getByText('Please enter a valid phone number.').waitFor()
  await page.getByLabel('Country/Region').selectOption('US')
  assert.equal(await page.getByLabel('Phone number').getAttribute('aria-invalid'), 'false', 'no stale phone error')
  assert.equal(await page.locator('.field-error').count(), 0, 'no stale field errors')
  assert.equal(await page.getByText(/highlighted field/).count(), 0, 'no stale banner')
  await page.getByLabel('State', { exact: true }).selectOption('WA') // the region resets on a switch
  await page.getByLabel('Make this my default address').check()
  await page.getByRole('button', { name: 'Add address' }).click()
  await page.waitForURL(/\/account\/addresses/)
  await page.getByRole('article', { name: 'Default address: Eve Tester' }).waitFor()
  await header.getByRole('link', { name: /^Deliver to Eve Seattle 98109/ }).waitFor()
  await page.locator('footer').getByText('Country: United States').waitFor()

  step('checkout to the US address uses US rules in the display currency (USD): FREE over $35, 8.25% tax')
  await page.goto(`${base}/dp/6`)
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).first().click()
  await waitCart(1)
  await page.goto(`${base}/checkout`)
  await page.getByRole('heading', { name: 'Delivering to Eve Tester' }).waitFor()
  await review().getByLabel(/FREE Standard Delivery/).waitFor()
  const us = await rows(summary())
  assert.deepEqual(us, {
    'Items (1):': '$49.99',
    'Shipping & handling:': '$6.99',
    'Free Shipping:': '-$6.99',
    'Total before tax:': '$49.99',
    'Estimated tax to be collected:': '$4.12', // 8.25% of $49.99
    'Order total:': '$54.11',
  })
  await summary().getByText('Estimated tax is a flat 8.25% of items and shipping.').waitFor()
  assert.equal(await summary().getByText(NOTE).count(), 0)

  step('the same US checkout in PKR: still FREE shipping and a tax line, and the column adds up in rupees')
  await context.addCookies([{ name: 'currency', value: 'PKR', url: base }])
  await page.goto(`${base}/checkout`)
  await summary().getByText('Estimated tax to be collected:').waitFor()
  const usPkr = await rows(summary())
  assert.equal(usPkr['Free Shipping:'], '-PKR 1,936.72')
  assert.equal(usPkr['Estimated tax to be collected:'], 'PKR 1,141.53')
  assert.equal(
    minor(usPkr['Order total:']),
    minor(usPkr['Items (1):']) + minor(usPkr['Shipping & handling:']) + minor(usPkr['Free Shipping:']) + minor(usPkr['Estimated tax to be collected:']),
  )

  step('390px wide: home, product page, checkout and the PKR order pages fit without horizontal scrolling')
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/', '/dp/6', '/checkout', '/orders', `/orders/${orderId}`, `/orders/${orderId}/invoice`, `/orders/${orderId}/track`, `/thankyou/${orderId}`]) {
    await page.goto(base + path)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} overflows at 390px`)
  }

  console.log('e2e region ok')
} catch (e) {
  await page.screenshot({ path: 'e2e/region-failure.png', fullPage: true }).catch(() => {})
  console.error(`failed at ${page.url()} (screenshot: e2e/region-failure.png)`)
  throw e
} finally {
  await browser.close()
}
