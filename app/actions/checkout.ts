'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAddress } from '@/lib/addresses'
import { getUser, requireUser } from '@/lib/auth'
import { advanceCents, codStanding } from '@/lib/cod'
import { queueOrderEmail } from '@/lib/order-emails'
import { recordGroupOrder } from '@/lib/group-buy'
import { buyNowLine, cartLines, createOrder, linesKey, orderIdForKey, quote } from '@/lib/orders'
import { getNileDay } from '@/lib/nile-day'
import { countryCodeFromName } from '@/lib/region'
import { getShopperPrices } from '@/lib/price-lock'
import { DECLINED_LAST4, getCard } from '@/lib/payments'
import { getRegion } from '@/lib/region-server'

export type PlaceOrderState = { error: string; orderId?: string } | null

const TOKEN = /^[0-9a-f-]{36}$/

// A checkout the browser restores with Back asks whether its token already placed an order, so it can't be placed twice.
export async function placedOrderId(token: string) {
  const user = await getUser()
  return user && TOKEN.test(token) ? orderIdForKey(user.id, token) : null
}

// Everything is re-checked here: ownership of the address and card, product ids, stock, quantity limits, and prices.
// Totals come from lib/orders + lib/catalog, never from the form. The per-render `token` makes double submits idempotent.
export async function placeOrder(_prev: PlaceOrderState, form: FormData): Promise<PlaceOrderState> {
  const buy = form.get('buy') ? String(form.get('buy')) : null
  const qty = String(form.get('qty') ?? '1')
  const user = await requireUser(buy ? `/checkout?buy=${encodeURIComponent(buy)}&qty=${encodeURIComponent(qty)}` : '/checkout')

  const key = String(form.get('token') ?? '')
  if (!TOKEN.test(key)) {
    refresh()
    return { error: 'Your checkout session has expired. Please review your order and try again.' }
  }
  const placed = await orderIdForKey(user.id, key)
  if (placed) return { error: 'You already placed this order.', orderId: placed }

  const line = buy ? buyNowLine(buy, qty, await getShopperPrices(user.id)) : null
  const lines = buy ? (line ? [line] : []) : await cartLines()
  if (!lines.length) {
    if (!buy) redirect('/cart')
    return { error: 'This item is currently unavailable.' }
  }
  if (linesKey(lines) !== form.get('lines')) {
    refresh()
    return { error: 'Some items in your order have changed. Please review before placing your order.' }
  }

  const address = await getAddress(user.id, String(form.get('addressId') ?? ''))
  if (!address) return { error: 'Please select a delivery address.' }
  const cash = form.get('payment') === 'cod'
  const card = await getCard(user.id, String(form.get('cardId') ?? ''))
  if (!cash && !card) return { error: 'Please select a payment method.' }
  if (card && card.expired) return { error: 'Your card has expired. Please select another payment method or add a new card.' }
  if (card && card.last4 === DECLINED_LAST4 && !cash) {
    return { error: 'There was a problem with your payment. Your card was declined. Please select another payment method or add a new card.' }
  }
  // a refused parcel means we take part of a cash order up front, on the card they picked (lib/cod.ts)
  const standing = cash ? await codStanding(user.id) : null
  if (standing?.advanceRate && !card) return { error: `Please add a card for the ${Math.round(standing.advanceRate * 100)}% we take up front on cash orders.` }

  const speed = form.get('speed') === 'expedited' ? 'expedited' : 'standard'
  // the order keeps the currency and rate shown right now; shipping and tax follow the address's country
  const { currency, rate } = await getRegion()
  const advance = standing?.advanceRate ? advanceCents(quote(lines, speed, undefined, countryCodeFromName(address.country), await getNileDay(user.id)).totalCents, standing.advanceRate) : 0
  const created = await createOrder({
    userId: user.id, key, address, lines, speed, fromCart: !buy, currency, fxRate: rate,
    card: cash && !advance ? null : card, paymentKind: cash ? 'cod' : 'card', advanceCents: advance,
  })
  const id = created ?? (await orderIdForKey(user.id, key))
  if (!id) return { error: "We couldn't place your order. Please try again." }
  if (created) {
    // a group buy the shopper has now bought on: the membership keeps the order, so they can't leave it afterwards
    await recordGroupOrder(user.id, lines.map((l) => l.product.id), created)
    await queueOrderEmail('confirmation', user.id, created) // once per order, never for a repeated submit
  }
  redirect(`/thankyou/${id}`)
}
