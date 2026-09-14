import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PGlite loads its wasm and data files at runtime, so keep it out of the server bundle
  serverExternalPackages: ['@electric-sql/pglite'],
  images: { remotePatterns: [new URL('https://cdn.dummyjson.com/product-images/**')] },
}

export default nextConfig
