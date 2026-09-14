'use server'

import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProduct } from '@/lib/catalog'
import { saveReview as save, reviewFeedback } from '@/lib/reviews'

export type ReviewErrors = { rating?: string; headline?: string; body?: string; form?: string }
export type ReviewState = { ok: boolean; errors?: ReviewErrors }
export type FeedbackState = { ok: true } | { ok: false; error: string } | null

export async function saveReview(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const p = getProduct(Number(form.get('productId')))
  if (!p) return { ok: false, errors: { form: 'This item is no longer available.' } }
  const user = await getUser()
  if (!user) redirect(`/ap/signin?return_to=${encodeURIComponent(`/review/create/${p.id}`)}`)

  const rating = Number(form.get('rating'))
  const headline = String(form.get('headline') ?? '').trim()
  const body = String(form.get('body') ?? '').trim()
  const errors: ReviewErrors = {}
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'Please select a star rating'
  if (!headline) errors.headline = 'Please enter a headline'
  else if (headline.length > 150) errors.headline = 'Please shorten your headline to 150 characters or fewer'
  if (!body) errors.body = 'Please enter your review'
  else if (body.length > 5000) errors.body = 'Please shorten your review to 5,000 characters or fewer'
  if (Object.keys(errors).length) return { ok: false, errors }

  await save(user.id, p.id, rating, headline, body)
  return { ok: true }
}

// Fields: reviewId (uuid or seed-{productId}-{index}), kind (helpful | report).
export async function sendReviewFeedback(_prev: FeedbackState, form: FormData): Promise<FeedbackState> {
  const kind = form.get('kind') === 'report' ? 'report' : 'helpful'
  const user = await getUser()
  if (!user) return { ok: false, error: kind === 'report' ? 'Sign in to report reviews.' : 'Sign in to vote on reviews.' }
  const saved = await reviewFeedback(user.id, String(form.get('reviewId') ?? ''), kind)
  return saved ? { ok: true } : { ok: false, error: 'Sorry, we failed to record your feedback. Please try again.' }
}
