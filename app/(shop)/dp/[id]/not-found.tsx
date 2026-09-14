import Link from 'next/link'

export default function ProductNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-2xl font-normal">Sorry! We couldn&apos;t find that page.</h1>
      <p className="mt-3">
        Try searching or go to <Link href="/" className="link">nile&apos;s home page</Link>.
      </p>
    </div>
  )
}
