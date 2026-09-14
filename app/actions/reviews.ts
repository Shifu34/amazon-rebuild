'use server'

import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProduct } from '@/lib/catalog'
import { saveReview as save, voteHelpful } from '@/lib/reviews'

export type ReviewErrors = { rating?: string; headline?: string; body?: string; form?: string }
export type ReviewState = { ok: boolean; errors?: ReviewErrors }
export type HelpfulState = { ok: true } | { ok: false; error: string } | null

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

export async function markHelpful(_prev: HelpfulState, form: FormData): Promise<HelpfulState> {
  const reviewId = String(form.get('reviewId') ?? '')
  const user = await getUser()
  if (!user) return { ok: false, error: 'Sign in to vote on reviews.' }
  if (!UUID.test(reviewId)) return { ok: false, error: 'Sorry, we failed to record your vote. Please try again.' }
  await voteHelpful(user.id, reviewId)
  return { ok: true }
}
