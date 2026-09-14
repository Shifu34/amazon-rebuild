import { notFound } from 'next/navigation'

// Unknown URLs 404 inside the store layout, so they keep the real header, search and footer (§2.25).
export default function MissingPage() {
  notFound()
}
