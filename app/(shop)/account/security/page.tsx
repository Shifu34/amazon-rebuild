import type { Metadata } from 'next'
import { signOutEverywhere } from '@/app/actions/account'
import { SecurityPanel } from '@/components/account/security-panel'
import { Crumbs } from '@/components/account/ui'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Login & Security' }

export default async function SecurityPage() {
  const user = await requireUser('/account/security')
  return (
    <div className="mx-auto max-w-[640px] px-4 py-6">
      <Crumbs trail={[['Your Account', '/account'], ['Login & security']]} />
      <h1 className="mb-4 text-[28px] leading-9 font-normal">Login &amp; security</h1>
      <SecurityPanel name={user.name} email={user.email} />

      <section className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-line p-4 sm:flex-row sm:justify-between sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <h2 className="text-sm font-bold">Compromised account?</h2>
          <p className="text-sm text-muted">Sign out of nile on every device, including this one. You&apos;ll need your password to sign back in.</p>
        </div>
        <form action={signOutEverywhere}>
          <button type="submit" className="btn btn-plain">Sign out everywhere</button>
        </form>
      </section>
    </div>
  )
}
