import type { Metadata } from 'next'
import Link from 'next/link'
import { safeReturnTo } from '@/lib/auth'

export const metadata: Metadata = { title: 'Password assistance' }

// nile sends no email, so there is no reset code to send. Say so plainly and offer the ways forward.
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const returnTo = safeReturnTo((await searchParams).return_to)
  const query = returnTo !== '/' ? `?return_to=${encodeURIComponent(returnTo)}` : ''
  return (
    <div className="rounded-lg border border-[#ddd] px-5 py-5 text-[13px] leading-5">
      <h1 className="mb-3 text-[28px] leading-9 font-normal">Password assistance</h1>
      <p>nile is a demo store and doesn&apos;t send email, so we can&apos;t send you a code to reset your password.</p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <li>Try again: your browser or password manager may have saved it.</li>
        <li>Or create a new account with another email address. It takes a few seconds.</li>
      </ul>
      <Link href={`/ap/register${query}`} className="btn btn-cart mt-5 w-full">Create a new account</Link>
      <Link href={`/ap/signin${query}`} className="btn btn-plain mt-2 w-full">Back to sign in</Link>
      <p className="mt-5 border-t border-[#e7e7e7] pt-4 text-xs text-muted">
        Still signed in somewhere? You can set a new password in Your Account › Login &amp; security.
      </p>
    </div>
  )
}
