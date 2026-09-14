import { ProductCard } from '@/components/product-card'
import { bestSellers } from '@/lib/catalog'

// interim home so the shell can be exercised; replaced by the real home page
export default function Home() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6">
      <h1 className="mb-4 text-2xl">Best Sellers</h1>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-6">
        {bestSellers(undefined, 12).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  )
}
