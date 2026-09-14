'use client'

import Link from 'next/link'

export default function OrdersError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl">Sorry! Something went wrong loading your orders.</h1>
      <p className="mt-2 text-sm">
        Please try again, or go to <Link href="/" className="link">nile&apos;s home page</Link>.
      </p>
      <button type="button" onClick={retry} className="btn btn-cart btn-lg mt-5">Try again</button>
    </div>
  )
}
