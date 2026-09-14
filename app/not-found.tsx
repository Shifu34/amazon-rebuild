import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo, SearchIcon } from '@/components/icons'

export const metadata: Metadata = { title: 'Page Not Found' }

// Like Amazon's 404: the apology and a way home. Unmatched URLs render this without the store layout, so it brings its own
// logo and search box (a plain GET form, works without JS). When a store page calls notFound(), it renders inside the store's
// <main id="main"> under the real header, so those two hide there.
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-4 py-12 text-center">
      <div className="flex w-full flex-col items-center [#main_&]:hidden">
        <Link href="/" aria-label="nile home" className="rounded-sm p-1 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none">
          <Logo tone="dark" />
        </Link>
        <form action="/s" role="search" className="mt-8 flex w-full max-w-md">
          <label htmlFor="nf-search" className="sr-only">Search nile</label>
          <input id="nf-search" name="k" type="search" placeholder="Search nile" className="input rounded-r-none" />
          <button type="submit" aria-label="Go" className="rounded-r-md bg-brand px-3 text-ink hover:brightness-95">
            <SearchIcon className="size-5" />
          </button>
        </form>
      </div>
      <h1 className="mt-10 text-2xl font-normal [#main_&]:mt-0">Sorry, we couldn&apos;t find that page</h1>
      <p className="mt-3 text-sm">
        The web address you entered is not a functioning page on our site. Try searching, or go to{' '}
        <Link href="/" className="link">nile&apos;s home page</Link>.
      </p>
    </div>
  )
}
