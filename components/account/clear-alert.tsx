'use client'

import { useEffect } from 'react'

// Drops ?alert= from the address bar once the confirmation is on screen, so a reload doesn't show it again.
export function ClearAlert() {
  useEffect(() => {
    const url = new URL(location.href)
    if (!url.searchParams.has('alert')) return
    url.searchParams.delete('alert')
    history.replaceState(null, '', url)
  })
  return null
}
