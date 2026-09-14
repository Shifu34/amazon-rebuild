import type { MetadataRoute } from 'next'

// A demo rebuild, not a real store: keep every crawler out.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } }
}
