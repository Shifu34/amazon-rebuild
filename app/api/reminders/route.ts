import { siteOrigin } from '@/lib/email'
import { sendDueReminders } from '@/lib/reminders'

// Daily cron (vercel.json) that sends every reminder now due. Safe to call repeatedly: each row is claimed before it is
// sent, so a retry never emails twice.
// The guard is CRON_SECRET, which Vercel sends as `Authorization: Bearer …` on scheduled runs. With no secret set the
// route stays shut and only the signed-in demo control (app/actions/reminders.ts) can send — a spoofable `x-vercel-cron`
// header is not a guard.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'not authorized' }, { status: 401 })
  }
  const sent = await sendDueReminders(await siteOrigin())
  return Response.json({ sent })
}
