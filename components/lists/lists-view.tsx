import Form from 'next/form'
import Link from 'next/link'
import { cartQuantities } from '@/lib/cart'
import { plural } from '@/lib/format'
import { listItems, type List } from '@/lib/lists'
import { CreateListDialog, ListActions } from './list-dialogs'
import { ListItems } from './list-items'

// Your Lists: rail of lists (a scrolling strip on phones) + the active list's items.
export async function ListsView({ lists, active, path, create }: { lists: List[]; active: List; path: string; create: boolean }) {
  const [items, inCart] = await Promise.all([listItems(active.id), cartQuantities()])
  const count = (l: List) => `${l.isDefault ? 'Default List · ' : ''}${plural(l.itemCount, 'item')}`

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <h1 className="mb-4 text-[28px] leading-9 font-normal">Your Lists</h1>
      <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Your lists" className="min-w-0 md:border-r md:border-line md:pr-4">
          <Link href={`${path}?create=1`} scroll={false} className="btn btn-cart btn-lg mb-3 w-full">Create a List</Link>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:block md:space-y-1 md:overflow-visible md:px-0">
            {lists.map((l) => (
              <li key={l.id} className="shrink-0">
                <Link
                  href={`/lists/${l.id}`}
                  aria-current={l.id === active.id ? 'page' : undefined}
                  className="block max-w-[220px] rounded-lg border border-line px-3 py-2 hover:bg-[#f7fafa] aria-[current=page]:border-link aria-[current=page]:bg-[#f7fafa] md:max-w-none md:rounded-none md:border-0 md:border-l-[3px] md:border-transparent"
                >
                  <span className="block truncate font-bold">{l.name}</span>
                  <span className="block text-xs text-muted">{count(l)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="list-title" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="min-w-0">
              <h2 id="list-title" className="text-2xl break-words">{active.name}</h2>
              <p className="text-xs text-muted">{count({ ...active, itemCount: items.length })}</p>
            </div>
            {!active.isDefault && <ListActions key={active.id} id={active.id} name={active.name} itemCount={items.length} />}
          </div>
          <ListItems
            key={active.id}
            listId={active.id}
            items={items.map(({ product: p, addedAt }) => ({
              id: p.id, title: p.title, brand: p.brand, thumbnail: p.thumbnail, price: p.price, listPrice: p.listPrice,
              rating: p.rating, ratingCount: p.ratingCount, stock: p.stock, addedAt: addedAt.toISOString(), inCart: inCart.get(p.id),
            }))}
            otherLists={lists.filter((l) => l.id !== active.id).map(({ id, name }) => ({ id, name }))}
            empty={
              <div className="py-12 text-center">
                <h3 className="text-xl">This list is empty</h3>
                <p className="mt-1 text-sm text-muted">Add items you want to shop for later. Use Add to List on any product page.</p>
                <Form action="/s" role="search" className="mx-auto mt-5 flex max-w-sm gap-2">
                  <label htmlFor="list-search" className="sr-only">Search nile</label>
                  <input id="list-search" name="k" type="search" placeholder="Search nile" className="input h-9" />
                  <button type="submit" className="btn btn-cart btn-lg">Search</button>
                </Form>
                <Link href="/" className="link mt-3 inline-block text-sm">Continue shopping</Link>
              </div>
            }
          />
        </section>
      </div>
      <CreateListDialog open={create} closeHref={path} />
    </div>
  )
}
