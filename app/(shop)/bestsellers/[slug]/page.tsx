import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ranked, scopeLabel } from '@/components/home/scope'
import { BestSellersLayout, RankTile } from '../shared'

export async function generateMetadata({ params }: PageProps<'/bestsellers/[slug]'>): Promise<Metadata> {
  const name = scopeLabel((await params).slug)
  return { title: name ? `Best Sellers in ${name}` : 'Page not found' }
}

export default async function BestSellersIn({ params }: PageProps<'/bestsellers/[slug]'>) {
  const { slug } = await params
  const name = scopeLabel(slug)
  if (!name) notFound()
  const items = ranked(slug, 50)

  return (
    <BestSellersLayout slug={slug}>
      <h1 className="mb-4 text-2xl leading-8 font-bold">Best Sellers in {name}</h1>
      {items.length ? (
        <ol className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {items.map((p, i) => (
            <li key={p.id}><RankTile product={p} rank={i + 1} action /></li>
          ))}
        </ol>
      ) : (
        <p className="rounded-lg border border-line px-6 py-10 text-center text-muted">Nothing has sold in {name} yet. Check back soon.</p>
      )}
    </BestSellersLayout>
  )
}
