'use client'

import { useActionState, useState } from 'react'
import { markHelpful, type HelpfulState } from '@/app/actions/reviews'

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

export function HelpfulButton({ reviewId }: { reviewId: string }) {
  const [state, action, pending] = useActionState<HelpfulState, FormData>(markHelpful, null)
  if (state?.ok) return <p role="status" className="text-success">✓ Thank you for your feedback.</p>
  return (
    <form action={action}>
      <input type="hidden" name="reviewId" value={reviewId} />
      <button type="submit" disabled={pending} className="btn btn-plain">Helpful</button>
      {state && !state.ok && <p role="alert" className="field-error">{state.error}</p>}
    </form>
  )
}
