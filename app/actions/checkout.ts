'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAddress } from '@/lib/addresses'
import { requireUser } from '@/lib/auth'
import { buyNowLine, cartLines, createOrder, linesKey, orderIdForKey } from '@/lib/orders'
import { DECLINED_LAST4, getCard } from '@/lib/payments'

export type PlaceOrderState = { error: string } | null

// Everything is re-checked here: ownership of the address and card, product ids, stock, quantity limits, and prices.
// Totals come from lib/orders + lib/catalog, never from the form. The per-render `token` makes double submits idempotent.
export async function placeOrder(_prev: PlaceOrderState, form: FormData): Promise<PlaceOrderState> {
  const buy = form.get('buy') ? String(form.get('buy')) : null
  const qty = String(form.get('qty') ?? '1')
  const user = await requireUser(buy ? `/checkout?buy=${encodeURIComponent(buy)}&qty=${encodeURIComponent(qty)}` : '/checkout')

  const key = String(form.get('token') ?? '')
  if (!/^[0-9a-f-]{36}$/.test(key)) {
    refresh()
    return { error: 'Your checkout session has expired. Please review your order and try again.' }
  }
  const placed = await orderIdForKey(user.id, key)
  if (placed) redirect(`/thankyou/${placed}`)

  const line = buy ? buyNowLine(buy, qty) : null
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
  const card = await getCard(user.id, String(form.get('cardId') ?? ''))
  if (!card) return { error: 'Please select a payment method.' }
  if (card.expired) return { error: 'Your card has expired. Please select another payment method or add a new card.' }
  if (card.last4 === DECLINED_LAST4) return { error: 'There was a problem with your payment. Your card was declined. Please select another payment method or add a new card.' }

  const speed = form.get('speed') === 'expedited' ? 'expedited' : 'standard'
  const id = (await createOrder({ userId: user.id, key, address, card, lines, speed, fromCart: !buy })) ?? (await orderIdForKey(user.id, key))
  if (!id) return { error: "We couldn't place your order. Please try again." }
  redirect(`/thankyou/${id}`)
}
