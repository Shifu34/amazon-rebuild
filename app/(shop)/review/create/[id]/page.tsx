import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReviewForm } from '@/components/pdp/review-form'
import { requireUser } from '@/lib/auth'
import { getProduct } from '@/lib/catalog'
import { ownReview } from '@/lib/reviews'

type Props = { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: 'Create Review' }

export default async function CreateReviewPage({ params }: Props) {
  const { id } = await params
  const p = /^\d{1,9}$/.test(id) ? getProduct(Number(id)) : undefined
  if (!p) notFound()
  const user = await requireUser(`/review/create/${p.id}`)
  const existing = await ownReview(user.id, p.id)

  return (
    <div className="mx-auto max-w-[700px] px-4 py-6">
      <h1 className="text-[28px] leading-9 font-normal">{existing ? 'Edit Review' : 'Create Review'}</h1>
      <Link href={`/dp/${p.id}`} className="group mt-3 flex items-center gap-3 border-b border-line pb-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-sm bg-[#f7f7f7] p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.thumbnail} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" />
        </span>
        <span className="line-clamp-2 text-sm group-hover:text-link-hover group-hover:underline">{p.title}</span>
      </Link>
      <div className="mt-6">
        <ReviewForm productId={p.id} existing={existing ? { rating: existing.rating, headline: existing.headline, body: existing.body } : undefined} />
      </div>
    </div>
  )
}
