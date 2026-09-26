'use client'

import Form from 'next/form'
import { SearchIcon } from '@/components/icons'

type Props = { productId: number; star: string; starOptions: [string, string][]; verifiedOnly: boolean; sort: string; keyword: string; mentions?: string }

// GET form: selects apply on change (client navigation), the keyword applies on Search/Enter. Every change resets to page 1.
export function ReviewFilters({ productId, star, starOptions, verifiedOnly, sort, keyword, mentions }: Props) {
  return (
    <Form
      action={`/product-reviews/${productId}`}
      onChange={(e) => (e.target as HTMLElement).tagName === 'SELECT' && e.currentTarget.requestSubmit()}
      className="space-y-3"
    >
      {/* the digest's aspect filter is not a control here, so carry it or a dropdown change would drop it */}
      {mentions && <input type="hidden" name="mentions" value={mentions} />}
      <div className="flex max-w-md gap-2">
        <label htmlFor="review-search" className="sr-only">Search customer reviews</label>
        <input id="review-search" name="filterByKeyword" type="search" defaultValue={keyword} placeholder="Search customer reviews" className="input h-9" />
        <button type="submit" className="btn btn-plain h-9">
          <SearchIcon className="size-4" /> Search
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 text-[13px]">
        <span className="font-medium text-muted">Filter by</span>
        <label className="flex items-center gap-1">
          <span className="sr-only">Star rating</span>
          <select name="filterByStar" defaultValue={star} className="select-pill">
            {starOptions.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="sr-only">Reviewer type</span>
          <select name="reviewerType" defaultValue={verifiedOnly ? 'avp_only_reviews' : 'all_reviews'} className="select-pill">
            <option value="all_reviews">All reviewers</option>
            <option value="avp_only_reviews">Verified purchase only</option>
          </select>
        </label>
        <label className="flex items-center gap-1 sm:ml-auto">
          <span className="font-medium text-muted">Sort by</span>
          <select name="sortBy" defaultValue={sort} className="select-pill">
            <option value="helpful">Top reviews</option>
            <option value="recent">Most recent</option>
          </select>
        </label>
      </div>
    </Form>
  )
}
