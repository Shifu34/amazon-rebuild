import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PGlite loads its wasm and data files at runtime, so keep it out of the server bundle
  serverExternalPackages: ['@electric-sql/pglite'],
  // 40 is the Data saver quality (app/actions/data-saver.ts); Next 16 only optimises qualities on this list
  images: { remotePatterns: [new URL('https://cdn.dummyjson.com/product-images/**')], qualities: [40, 75] },
}

export default nextConfig
