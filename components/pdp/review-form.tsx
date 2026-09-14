'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { saveReview, type ReviewState } from '@/app/actions/reviews'
import { CheckCircle } from './added-sheet'

type Existing = { rating: number; headline: string; body: string } | undefined

const STAR = 'M12 2.2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17.1l-6.1 3.5 1.5-6.8-5.2-4.6 6.9-.7z'

function Error({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="field-error flex items-center gap-1.5">
      <span aria-hidden className="flex size-3.5 items-center justify-center rounded-full bg-[#cc0c39] text-[10px] font-bold text-white">!</span>
      {message}
    </p>
  )
}

export function ReviewForm({ productId, existing }: { productId: number; existing: Existing }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(saveReview, { ok: false })
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [hover, setHover] = useState(0)
  const [headline, setHeadline] = useState(existing?.headline ?? '')
  const [body, setBody] = useState(existing?.body ?? '')
  const errors = state.errors ?? {}
  const formRef = useRef<HTMLFormElement>(null)

  // A failed submit moves focus to the first field with an error; the disabled Submit button would otherwise drop it on <body>.
  useEffect(() => {
    const e = state.errors
    const first = e?.rating ? 'rating' : e?.headline ? 'headline' : e?.body ? 'body' : null
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
  }, [state])

  if (state.ok) {
    return (
      <div role="status" className="rounded-lg border border-[#0b7b3c] p-5">
        <h2 className="flex items-center gap-2 text-lg text-success">
          <CheckCircle /> Review submitted - Thank you!
        </h2>
        <p className="mt-2 text-sm">Your review is now live on the product page.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/dp/${productId}#reviews`} className="btn btn-cart">Back to the product</Link>
          <Link href={`/product-reviews/${productId}?sortBy=recent`} className="btn btn-plain">See all reviews</Link>
        </div>
      </div>
    )
  }

  const shown = hover || rating
  return (
    <form ref={formRef} action={action} noValidate className="space-y-6">
      <input type="hidden" name="productId" value={productId} />
      {errors.form && <p role="alert" className="field-error">{errors.form}</p>}

      <fieldset aria-describedby={errors.rating ? 'rating-error' : undefined}>
        <legend className="text-lg font-bold">Overall rating</legend>
        <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} onMouseEnter={() => setHover(n)} className="cursor-pointer rounded p-0.5 has-[:focus-visible]:bg-[#e6f6f8] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} aria-label={n === 1 ? '1 star' : `${n} stars`} className="sr-only" />
              <svg viewBox="0 0 24 24" className="size-9" aria-hidden>
                <path d={STAR} strokeWidth="1.3" strokeLinejoin="round" className={n <= shown ? 'fill-[#ffa41c] stroke-star' : 'fill-white stroke-[#949494]'} />
              </svg>
            </label>
          ))}
          {rating > 0 && (
            <>
              <span className="ml-2 text-sm text-muted">{rating} out of 5</span>
              <button type="button" onClick={() => setRating(0)} className="link ml-3 cursor-pointer text-sm">Clear</button>
            </>
          )}
        </div>
        <Error id="rating-error" message={errors.rating} />
      </fieldset>

      <div className="border-t border-line pt-6">
        <label htmlFor="review-headline" className="text-lg font-bold">Add a headline</label>
        <input
          id="review-headline"
          name="headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          maxLength={150}
          placeholder="What's most important to know?"
          aria-invalid={!!errors.headline}
          aria-describedby={errors.headline ? 'headline-error' : undefined}
          className="input mt-2 h-9"
        />
        <Error id="headline-error" message={errors.headline} />
      </div>

      <div className="border-t border-line pt-6">
        <label htmlFor="review-body" className="text-lg font-bold">Add a written review</label>
        <textarea
          id="review-body"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={6}
          placeholder="What did you like or dislike? What did you use this product for?"
          aria-invalid={!!errors.body}
          aria-describedby={errors.body ? 'body-error body-count' : 'body-count'}
          className="input mt-2"
        />
        <div className="flex justify-between gap-4">
          <Error id="body-error" message={errors.body} />
          <p id="body-count" className="mt-1 ml-auto text-xs text-muted">{body.length.toLocaleString('en-US')}/5,000</p>
        </div>
      </div>

      <div className="flex justify-end border-t border-line pt-6">
        <button type="submit" disabled={pending} className="btn btn-cart btn-lg min-w-32">{pending ? 'Submitting…' : 'Submit'}</button>
      </div>
    </form>
  )
}
