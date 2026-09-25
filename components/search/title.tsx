'use client'

import { useEffect } from 'react'

// Next streams metadata for dynamic pages, and a prefetched /s entry can leave the previous search's <title> in the tab
// (seen live: search from the home page and the tab still reads "nile.com : Electronics"). The body is right either way,
// so set the title from the resolved query and the tab always names what is on screen.
export function SearchTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title
  }, [title])
  return null
}
