// Data saver end to end in headless Chrome: the switch round-trips, pictures come from Next's optimiser instead of the
// CDN, tiles stop playing, and the default page is untouched. Prints the image bytes each way.
// Run with the app up: node e2e/data-saver.mjs [baseUrl]   (default http://localhost:3000)
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:3000'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const step = (name) => console.log(`- ${name}`)

// every image byte the page actually pulled down, CDN or optimiser
async function imageBytes(page, path) {
  let bytes = 0
  const seen = []
  const onResponse = async (r) => {
    if (!/image/.test(r.headers()['content-type'] ?? '')) return
    seen.push(r.url())
    try {
      bytes += (await r.body()).length
    } catch {} // a response that never finished; it costs nothing either way
  }
  page.on('response', onResponse)
  await page.goto(base + path, { waitUntil: 'networkidle' })
  page.off('response', onResponse)
  return { bytes, count: seen.length, urls: seen }
}

try {
  step('off by default: the switch says Off and pictures are the raw CDN files')
  const plain = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await plain.newPage()
  await page.goto(`${base}/s?k=phone`)
  const toggle = page.getByRole('switch', { name: 'Data saver' })
  assert.equal(await toggle.getAttribute('aria-checked'), 'false')
  const firstCard = page.locator('main li article img').first()
  assert.match(await firstCard.getAttribute('src'), /^https:\/\/cdn\.dummyjson\.com\//, 'default pictures stay on the CDN')

  step('the switch turns it on, survives navigation, and turns back off')
  await toggle.click()
  await page.getByRole('switch', { name: 'Data saver', checked: true }).waitFor()
  assert.match(await page.locator('main li article img').first().getAttribute('src'), /^\/_next\/image\?/, 'optimised pictures')
  await page.goto(`${base}/dp/1`)
  assert.equal(await page.getByRole('switch', { name: 'Data saver' }).getAttribute('aria-checked'), 'true', 'the cookie sticks')
  await page.goto(`${base}/s?k=phone`)
  await page.getByRole('switch', { name: 'Data saver' }).click()
  await page.getByRole('switch', { name: 'Data saver', checked: false }).waitFor()
  await plain.close()

  step('home tiles: hovering plays a reel normally, and never in data saver')
  const saver = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await saver.addCookies([{ name: 'data_saver', value: '1', url: base }])
  const savePage = await saver.newPage()
  await savePage.goto(base)
  const tile = savePage.getByRole('list', { name: 'Shop by department' }).getByRole('link').first()
  await tile.hover()
  await savePage.waitForTimeout(1500)
  assert.equal(await savePage.getByRole('button', { name: /^Pause / }).count(), 0, 'no reel in data saver')
  assert.equal(await savePage.getByRole('button', { name: /^(Play|Replay) / }).count(), 0, 'no playback control either')
  const tileImgs = await savePage.getByRole('list', { name: 'Shop by department' }).locator('li').first().locator('img').count()
  assert.equal(tileImgs, 1, 'one still per tile, no preloaded next frame')

  step('measure: image bytes on a results grid, with data saver off vs on')
  // The grids are where the saving is: every picture comes from the optimiser at quality 40 and links stop prefetching.
  // The home page is dominated by tile stills that stay on the CDN either way (a client component cannot read the cookie
  // on the server), and its lazy images make byte counts swing run to run, so it is not measured here.
  const off = await imageBytes(await freshPage(false), '/s?k=phone')
  const on = await imageBytes(await freshPage(true), '/s?k=phone')
  const pct = Math.round(((off.bytes - on.bytes) / off.bytes) * 100)
  console.log(`  /s?k=phone: off ${(off.bytes / 1024).toFixed(0)} KB (${off.count} images) -> on ${(on.bytes / 1024).toFixed(0)} KB (${on.count}) - ${pct}% less`)
  assert.ok(pct >= 25, `the grid should save a real share of the image bytes, saved ${pct}%`)
  // the optimiser's own URLs carry the CDN address in their query string, so compare the path, not the whole URL
  // (the site icon is an SVG and has nothing to optimise)
  const photos = on.urls.filter((u) => !new URL(u).pathname.endsWith('.svg'))
  assert.ok(photos.length > 0 && photos.every((u) => new URL(u).pathname === '/_next/image'), 'every photo goes through the optimiser in data saver')
  await saver.close()

  console.log('data saver e2e passed')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await browser.close()
}

// a cold page for each measurement, so neither side benefits from the other's cache
async function freshPage(saver) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  if (saver) await ctx.addCookies([{ name: 'data_saver', value: '1', url: base }])
  return ctx.newPage()
}
