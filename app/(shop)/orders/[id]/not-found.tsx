import Link from 'next/link'

// Same page for a missing order and someone else's order, so ids can't be probed.
export default function OrderNotFound() {
  return (
    <div className="mx-auto max-w-[600px] px-4 py-20 text-center">
      <h1 className="text-2xl">We can&apos;t find that order</h1>
      <p className="mt-2 text-sm text-muted">It may belong to a different account, or the link may be incomplete.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/orders" className="btn btn-plain">Your Orders</Link>
        <Link href="/" className="btn btn-cart">Continue shopping</Link>
      </div>
    </div>
  )
}
