// Order emails in Amazon's style. Table layout with inline styles, so Gmail, Outlook and Apple Mail render them alike.
// Every amount is in the order's own currency and rate. Rendering is pure (no queries): npx tsx lib/email-templates.check.ts
import { orderSummary } from '@/components/checkout/summary'
import { DROP_OFF_DAYS } from '@/components/orders/rules'
import { formatAddress } from './addresses'
import { fullDate, longDate } from './format'
import { itemRefundCents, RETURN_DAYS, type Order, type OrderItem } from './orders'
import { countryCodeFromName, formatMoney, IMPORT_FEES_NOTE, summarize } from './region'

export type OrderEmailKind = 'confirmation' | 'cancelled' | 'return' | 'delivered'
export type OrderEmailInput = { order: Order; name: string; origin: string; productIds?: number[] }
export type RenderedEmail = { subject: string; html: string; text: string }

const DAY = 86_400_000
const F = 'font-family:Arial,Helvetica,sans-serif;' // inline on every element: Gmail strips <body> styles and Outlook doesn't inherit fonts into tables
const C = { ink: '#0f1111', muted: '#565959', line: '#e7e7e7', total: '#b12704', success: '#067d62' }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
const clip = (s: string, n = 45) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'there'
// Amazon's subject style: "First item title" and 2 more items
const quoted = (items: { title: string }[]) =>
  `"${clip(items[0]?.title ?? 'your item')}"${items.length > 1 ? ` and ${items.length - 1} more item${items.length > 2 ? 's' : ''}` : ''}`
const intl = (o: Order) => countryCodeFromName(o.shipTo.country) !== 'US'
// "Seattle, WA 98109" | "Lahore, Punjab 54000, Pakistan"
const place = (o: Order) => [formatAddress({ ...o.shipTo, line1: '', line2: '' }), intl(o) && o.shipTo.country].filter(Boolean).join(', ')
const money = (o: Order, cents: number) => formatMoney(cents, o.currency, o.fxRate)
// a column of amounts in the order's currency: the converted rows and their sum
const sum = (o: Order, cents: number[]) => summarize(cents.map((usdCents) => ({ label: '', usdCents })), o.currency, o.fxRate).total.text

const p = (html: string, style = '') => `<p style="${F}margin:0 0 14px;font-size:14px;line-height:21px;${style}">${html}</p>`
const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="${F}display:inline-block;background:#ffd814;border:1px solid #fcd200;border-radius:999px;padding:10px 24px;color:${C.ink};font-size:14px;text-decoration:none">${esc(label)}</a>`
const link = (href: string, label: string) => `<a href="${esc(href)}" style="color:#007185;text-decoration:none">${esc(label)}</a>`
// international orders: duties are the carrier's, said wherever amounts are
const importNote = (o: Order) => (intl(o) ? p(esc(IMPORT_FEES_NOTE), `font-size:13px;color:${C.muted}`) : '')
const textImportNote = (o: Order) => (intl(o) ? `\n${IMPORT_FEES_NOTE}` : '')

function itemsTable(o: Order, items: OrderItem[], amount: (i: OrderItem) => number) {
  const cell = `${F}border-top:1px solid ${C.line};padding:10px 0;vertical-align:top`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 14px">${items
    .map(
      (i) => `<tr>
<td width="68" style="${cell}"><img src="${esc(i.thumbnail)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:contain;background:#f7f7f7;border-radius:6px"></td>
<td style="${cell};padding-left:12px;padding-right:12px;font-size:14px;line-height:19px">${esc(i.title)}<div style="font-size:12px;color:${C.muted};margin-top:2px">Qty: ${i.quantity}</div></td>
<td align="right" style="${cell};font-size:14px;white-space:nowrap">${money(o, amount(i))}</td>
</tr>`,
    )
    .join('')}</table>`
}

function summary(rows: [label: string, value: string][], total: [label: string, value: string]) {
  const row = ([k, v]: [string, string], strong = false) =>
    `<tr><td style="${F}padding:${strong ? '9px' : '3px'} 0 3px;font-size:${strong ? 16 : 14}px;${strong ? `font-weight:bold;color:${C.total};border-top:1px solid ${C.line}` : ''}">${esc(k)}</td>` +
    `<td align="right" style="${F}padding:${strong ? '9px' : '3px'} 0 3px;font-size:${strong ? 16 : 14}px;white-space:nowrap;${strong ? `font-weight:bold;color:${C.total};border-top:1px solid ${C.line}` : ''}">${esc(v)}</td></tr>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 14px">${rows.map((r) => row(r)).join('')}${row(total, true)}</table>`
}

function layout(o: { preheader: string; title: string; body: string; reason: string }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#eaeded;font-family:Arial,Helvetica,sans-serif;color:${C.ink}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${F}background:#eaeded"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#131921;padding:14px 24px"><div style="${F}color:#ffffff;font-size:26px;line-height:26px;font-weight:900;letter-spacing:-1px">nile</div><div style="width:40px;height:4px;margin:3px 0 0 4px;border-radius:0 0 12px 12px;background:#ff9900"></div></td></tr>
<tr><td style="padding:24px 24px 6px"><h1 style="${F}margin:0 0 14px;font-size:22px;line-height:28px">${esc(o.title)}</h1>${o.body}</td></tr>
<tr><td style="${F}padding:16px 24px 20px;background:#f7f8f8;font-size:12px;line-height:18px;color:${C.muted}">${esc(o.reason)}<br>nile is a portfolio rebuild of Amazon.com and isn't affiliated with Amazon. Orders are simulated: nothing is charged and nothing ships.</td></tr>
</table></td></tr></table></body></html>`
}

const textFooter = '\n\nnile is a portfolio rebuild of Amazon.com and isn\'t affiliated with Amazon. Orders are simulated: nothing is charged and nothing ships.'
const textItems = (o: Order, items: OrderItem[], amount: (i: OrderItem) => number) => items.map((i) => `- ${i.title} (Qty: ${i.quantity}) ${money(o, amount(i))}`).join('\n')

function confirmation({ order, name, origin }: OrderEmailInput): RenderedEmail {
  const url = `${origin}/orders/${order.id}`
  const lineTotal = (i: OrderItem) => i.priceCents * i.quantity
  const { rows, total, speed } = orderSummary(order)
  const arriving = longDate(order.deliverBy)
  const body =
    p(`Hi ${esc(firstName(name))}, we've got your order. You can track or change it any time in Your Orders.`) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;background:#f7f8f8;border-radius:8px"><tr>
<td style="${F}padding:14px 16px;vertical-align:top;font-size:13px;color:${C.muted}">Arriving by<div style="font-size:16px;font-weight:bold;color:${C.success};margin:2px 0">${esc(arriving)}</div>${esc(speed)}</td>
<td style="${F}padding:14px 16px;vertical-align:top;font-size:13px;color:${C.muted}">Ship to<div style="font-size:14px;font-weight:bold;color:${C.ink};margin:2px 0">${esc(order.shipTo.fullName)}</div>${esc(place(order))}</td>
</tr></table>` +
    p(button(url, 'View or manage order')) +
    p(`Order #<b>${esc(order.id)}</b> · placed ${esc(fullDate(order.placedAt))}`, `font-size:13px;color:${C.muted};margin:6px 0 0`) +
    itemsTable(order, order.items, lineTotal) +
    summary(rows.map((r) => [r.label, r.text]), ['Order total:', total]) +
    importNote(order) +
    p(`Paid with ${esc(order.payment.brand)} ending in ${esc(order.payment.last4)}`, `font-size:13px;color:${C.muted}`)
  return {
    subject: `Ordered: ${quoted(order.items)}`,
    html: layout({ preheader: `Arriving by ${arriving} · Order #${order.id}`, title: 'Thanks for your order!', body, reason: 'You received this email because you placed an order on nile.' }),
    text: `Thanks for your order, ${firstName(name)}!\n\nArriving by ${arriving} (${speed})\nShip to ${order.shipTo.fullName}, ${place(order)}\nOrder #${order.id}, placed ${fullDate(order.placedAt)}\n\n${textItems(order, order.items, lineTotal)}\n\n${rows.map((r) => `${r.label} ${r.text}`).join('\n')}\nOrder total: ${total}${textImportNote(order)}\nPaid with ${order.payment.brand} ending in ${order.payment.last4}\n\nView or manage order: ${url}${textFooter}`,
  }
}

function cancelled({ order, name, origin, productIds = [] }: OrderEmailInput): RenderedEmail {
  const items = order.items.filter((i) => i.cancelledAt && (!productIds.length || productIds.includes(i.productId)))
  const whole = !!order.cancelledAt && order.items.every((i) => i.cancelledAt)
  const refund = (i: OrderItem) => itemRefundCents(i, countryCodeFromName(order.shipTo.country))
  const notCharged = whole ? orderSummary(order).total : sum(order, items.map(refund))
  const url = `${origin}/orders/${order.id}`
  const title = whole ? 'Your order has been canceled' : items.length === 1 ? 'An item has been canceled' : `${items.length} items have been canceled`
  const body =
    p(`Hi ${esc(firstName(name))}, as you asked, we've canceled ${whole ? `order #<b>${esc(order.id)}</b>` : `${items.length === 1 ? 'this item' : 'these items'} from order #<b>${esc(order.id)}</b>`}. You haven't been charged for ${items.length === 1 ? 'it' : 'them'}.`) +
    itemsTable(order, items, refund) +
    summary([], ['Not charged:', notCharged]) +
    importNote(order) +
    p(button(url, 'View order'))
  return {
    subject: whole ? `Your nile order #${order.id} has been canceled` : `Canceled: ${quoted(items)}`,
    html: layout({ preheader: `You haven't been charged for the canceled ${items.length === 1 ? 'item' : 'items'}.`, title, body, reason: 'You received this email because you canceled items from your nile order.' }),
    text: `${title}\n\nHi ${firstName(name)}, as you asked, we've canceled ${whole ? `order #${order.id}` : `items from order #${order.id}`}. You haven't been charged for them.\n\n${textItems(order, items, refund)}\n\nNot charged: ${notCharged}${textImportNote(order)}\n\nView order: ${url}${textFooter}`,
  }
}

function returnStarted({ order, name, origin, productIds = [] }: OrderEmailInput): RenderedEmail {
  const items = order.items.filter((i) => i.returnedAt && (!productIds.length || productIds.includes(i.productId)))
  const first = items[0]
  const code = first?.returnCode ?? ''
  const dropOffBy = fullDate(new Date((first?.returnedAt ?? new Date()).getTime() + DROP_OFF_DAYS * DAY))
  const how = first?.returnMethod === 'ups-pickup' ? 'UPS will pick up your package.' : 'Drop it off at any UPS Store. No box or label needed.'
  const replacement = first?.returnResolution === 'replacement'
  const refundOf = (i: OrderItem) => i.refundCents ?? 0
  const refund = sum(order, items.map(refundOf))
  const url = `${origin}/orders/${order.id}/return?code=${encodeURIComponent(code)}`
  const body =
    p(`Hi ${esc(firstName(name))}, your return is on its way. Return ${items.length === 1 ? 'your item' : 'your items'} by <b>${esc(dropOffBy)}</b>. ${esc(how)}`) +
    `<div style="${F}margin:0 0 6px;font-size:13px;color:${C.muted}">Show this code at drop-off</div><div style="margin:0 0 16px;padding:14px;border:1px dashed #888c8c;border-radius:8px;text-align:center;font:bold 22px/1 'Courier New',monospace;letter-spacing:3px">${esc(code)}</div>` +
    itemsTable(order, items, refundOf) +
    (replacement
      ? p('Your replacement ships as soon as the carrier scans your return. There is no charge for it.')
      : summary([], ['Estimated refund:', refund]) + p(`Refunded to ${esc(order.payment.brand)} ending in ${esc(order.payment.last4)} once the carrier scans your return.`, `font-size:13px;color:${C.muted}`)) +
    importNote(order) +
    p(button(url, 'View return'))
  return {
    subject: `Return started: ${quoted(items)}`,
    html: layout({ preheader: `Return code ${code}. Return by ${dropOffBy}.`, title: 'Your return has started', body, reason: 'You received this email because you started a return on nile.' }),
    text: `Your return has started\n\nReturn by ${dropOffBy}. ${how}\nReturn code: ${code}\n\n${textItems(order, items, refundOf)}\n\n${replacement ? 'Your replacement ships as soon as the carrier scans your return.' : `Estimated refund: ${refund} to ${order.payment.brand} ending in ${order.payment.last4}`}${textImportNote(order)}\n\nView return: ${url}${textFooter}`,
  }
}

function delivered({ order, name, origin }: OrderEmailInput): RenderedEmail {
  const items = order.items.filter((i) => !i.cancelledAt)
  const when = longDate(order.deliverBy)
  const returnBy = fullDate(new Date(order.deliverBy.getTime() + RETURN_DAYS * DAY))
  const url = `${origin}/orders/${order.id}`
  const lineTotal = (i: OrderItem) => i.priceCents * i.quantity
  const body =
    p(`Hi ${esc(firstName(name))}, your package was delivered ${esc(when)} to ${esc(order.shipTo.fullName)} in ${esc(order.shipTo.city)}. It was left near the front door or porch.`) +
    itemsTable(order, items, lineTotal) +
    p(`${button(url, 'View order')}&nbsp;&nbsp;${link(`${origin}/orders/${order.id}/return`, 'Return or replace items')}`) +
    p(`Most items can be returned until ${esc(returnBy)}.`, `font-size:13px;color:${C.muted}`) +
    importNote(order)
  return {
    subject: `Delivered: ${quoted(items)}`,
    html: layout({ preheader: `Delivered ${when}. Order #${order.id}`, title: 'Your package was delivered', body, reason: 'You received this email because an order you placed on nile was delivered.' }),
    text: `Your package was delivered ${when} to ${order.shipTo.fullName} in ${order.shipTo.city}.\n\n${textItems(order, items, lineTotal)}\n\nMost items can be returned until ${returnBy}.${textImportNote(order)}\nView order: ${url}${textFooter}`,
  }
}

const RENDER: Record<OrderEmailKind, (input: OrderEmailInput) => RenderedEmail> = { confirmation, cancelled, return: returnStarted, delivered }
export const orderEmail = (kind: OrderEmailKind, input: OrderEmailInput) => RENDER[kind](input)
