'use client'

import { useActionState } from 'react'
import { startDemo, type DemoState } from '@/app/actions/demo'

// Secondary option under the sign-in card. `token` comes from the server render, so a double submit reuses one shopper.
export function DemoButton({ token }: { token: string }) {
  const [state, action, pending] = useActionState<DemoState, FormData>(startDemo, null)
  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="token" value={token} />
      <p className="mb-3 flex items-center gap-2 text-xs text-muted">
        <span aria-hidden className="h-px flex-1 bg-line" />
        Just looking around?
        <span aria-hidden className="h-px flex-1 bg-line" />
      </p>
      <button type="submit" disabled={pending} aria-describedby="demo-note" className="btn btn-plain w-full">
        {pending ? 'Setting up your demo account…' : 'Explore with a demo account'}
      </button>
      <p id="demo-note" className="mt-1.5 text-center text-xs text-muted">
        Creates a fresh sample shopper with orders in every state, a saved address and test card, and a Shopping List.
      </p>
      {state?.error && !pending && <p role="alert" className="field-error">{state.error}</p>}
    </form>
  )
}
