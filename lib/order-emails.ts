import { after } from 'next/server'
import { one } from './db'
import { sendEmail, siteOrigin } from './email'
import { orderEmail, type OrderEmailKind } from './email-templates'
import { getOrder } from './orders'

// Sends an order email after the response has gone out, so the shopper never waits on SMTP.
// Call from a Server Action right after the write succeeds (before redirect, which throws).
export async function queueOrderEmail(kind: OrderEmailKind, userId: string, orderId: string, productIds?: number[]) {
  const origin = await siteOrigin() // request headers are only readable before after() runs
  after(async () => {
    const [user, order] = await Promise.all([
      one<{ name: string; email: string }>('select name, email from users where id = $1', [userId]),
      getOrder(userId, orderId),
    ])
    if (!user || !order) return
    const mail = orderEmail(kind, { order, name: user.name, origin, productIds })
    await sendEmail({ ...mail, to: user.email, kind: `order-${kind}`, userId, orderId })
  })
}
