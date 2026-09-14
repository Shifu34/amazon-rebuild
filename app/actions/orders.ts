'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { CANCEL_REASONS, COMMENT_MAX, PROBLEM_REASONS, RETURN_REASONS, returnFeeCents } from '@/components/orders/rules'
import { requireUser } from '@/lib/auth'
import { getProduct } from '@/lib/catalog'
import { queueOrderEmail } from '@/lib/order-emails'
import {
  cancelOrderItems, createReturn, getOrder, itemRefundCents, markDelivered, newReturnCode, orderView, quote, receiveReturns, returnBlocker,
} from '@/lib/orders'

export type OrderFormState = { error: string } | null

const SHIPPED = "This order has already shipped and can't be cancelled. You can return it after delivery."
const orderIdFrom = (form: FormData) => String(form.get('orderId') ?? '').slice(0, 40)
const pickedIds = (form: FormData) => new Set(form.getAll('item').map(Number))

// Owner only; the "not shipped yet" rule is checked here and again inside the SQL write.
export async function cancelItems(_prev: OrderFormState, form: FormData): Promise<OrderFormState> {
  const id = orderIdFrom(form)
  const user = await requireUser(`/orders/${encodeURIComponent(id)}/cancel`)
  const order = await getOrder(user.id, id)
  if (!order) return { error: "We couldn't find that order." }
  const view = orderView(order)
  if (view.status === 'cancelled') return { error: 'This order has already been cancelled.' }
  if (order.replacementFor) return { error: "This free replacement is part of your return, so it can't be cancelled on its own." }
  if (!view.canCancel) {
    refresh()
    return { error: SHIPPED }
  }
  const picked = pickedIds(form)
  const ids = order.items.filter((i) => !i.cancelledAt && picked.has(i.productId)).map((i) => i.productId)
  if (!ids.length) return { error: 'Please select at least one item to cancel.' }
  const reason = String(form.get('reason') ?? '')
  const n = await cancelOrderItems(user.id, order.id, ids, CANCEL_REASONS.includes(reason) ? reason : null, view.shippedAt)
  if (!n) {
    refresh()
    return { error: SHIPPED }
  }
  await queueOrderEmail('cancelled', user.id, order.id, ids)
  redirect(`/orders/${order.id}?cancelled=${n}`)
}

// Owner only; items must be delivered, inside their return window and not already returned. Refunds and fees are
// computed here from the stored order, never taken from the form.
export async function startReturn(_prev: OrderFormState, form: FormData): Promise<OrderFormState> {
  const id = orderIdFrom(form)
  const user = await requireUser(`/orders/${encodeURIComponent(id)}/return`)
  const order = await getOrder(user.id, id)
  if (!order) return { error: "We couldn't find that order." }
  const picked = pickedIds(form)
  const chosen = orderView(order).items.filter((i) => picked.has(i.productId))
  if (!chosen.length) return { error: 'Please select at least one item to return.' }
  const blocked = chosen.map((i) => returnBlocker(i.state)).find(Boolean)
  if (blocked) {
    refresh()
    return { error: blocked }
  }
  const reason = String(form.get('reason') ?? '')
  if (!RETURN_REASONS.includes(reason)) return { error: 'Please select a reason for return.' }
  const problem = PROBLEM_REASONS.has(reason)
  const comment = String(form.get('comment') ?? '').trim().slice(0, COMMENT_MAX)
  if (problem && !comment) return { error: 'Please tell us more about the problem.' }

  const lines = chosen.flatMap((i) => {
    const product = getProduct(i.productId)
    return product && product.stock > 0 ? [{ product, quantity: 1, requested: 1 }] : []
  })
  const replace = form.get('resolution') === 'replacement'
  if (replace && (!problem || lines.length < chosen.length)) return { error: "A replacement isn't available for this return. Please choose a refund." }
  const method = form.get('method') === 'ups-pickup' ? 'ups-pickup' : 'ups-store'

  let fee = returnFeeCents(reason, method, replace)
  const items = chosen.map((i) => {
    const full = replace ? 0 : itemRefundCents(i)
    const kept = Math.min(fee, full)
    fee -= kept
    return { productId: i.productId, refundCents: full - kept }
  })
  const code = newReturnCode()
  const replacement = replace ? { deliverBy: quote(lines, 'standard').deliverBy } : null
  const n = await createReturn({ userId: user.id, orderId: order.id, items, reason, comment, method, replacement, code })
  if (!n) {
    refresh()
    return { error: "We couldn't start this return because the order changed. Please review your items and try again." }
  }
  await queueOrderEmail('return', user.id, order.id, items.map((i) => i.productId))
  redirect(`/orders/${order.id}/return?code=${code}`)
}

// Demo controls on Order Details (orders are simulated). Both are scoped to the signed-in owner in SQL.
export async function demoMarkDelivered(form: FormData) {
  const id = orderIdFrom(form)
  const user = await requireUser(`/orders/${encodeURIComponent(id)}`)
  if (await markDelivered(user.id, id)) await queueOrderEmail('delivered', user.id, id)
  refresh()
}

export async function demoReceiveReturn(form: FormData) {
  const id = orderIdFrom(form)
  const user = await requireUser(`/orders/${encodeURIComponent(id)}`)
  await receiveReturns(user.id, id)
  refresh()
}
