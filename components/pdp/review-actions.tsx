'use client'

import { useActionState, useState } from 'react'
import { sendReviewFeedback, type FeedbackState } from '@/app/actions/reviews'

export function ReadMore({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 400
  return (
    <div className="mt-2 text-sm">
      <p className={`break-words whitespace-pre-line ${long && !open ? 'line-clamp-6' : ''}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="link mt-1 cursor-pointer">
          {open ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

// "Helpful" pill or "Report" link on a review card (signed in).
export function FeedbackButton({ reviewId, kind }: { reviewId: string; kind: 'helpful' | 'report' }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(sendReviewFeedback, null)
  const helpful = kind === 'helpful'
  if (state?.ok) return <p role="status" className={helpful ? 'text-success' : ''}>{helpful ? '✓ Thank you for your feedback.' : 'Reported. Thanks for letting us know.'}</p>
  return (
    <form action={action}>
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="kind" value={kind} />
      <button type="submit" disabled={pending} className={helpful ? 'btn btn-plain px-5' : 'cursor-pointer rounded hover:text-link-hover hover:underline disabled:opacity-55'}>
        {helpful ? 'Helpful' : 'Report'}
      </button>
      {state && !state.ok && <p role="alert" className="field-error">{state.error}</p>}
    </form>
  )
}
