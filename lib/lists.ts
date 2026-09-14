// Shopping lists. Every shopper has at most one default list ("Shopping List"), created the first time they save something.
import { getProduct, type Product } from './catalog'
import { one, query } from './db'

export type List = { id: string; name: string; isDefault: boolean; itemCount: number; createdAt: Date }
export type ListItem = { product: Product; addedAt: Date }

export const DEFAULT_LIST_NAME = 'Shopping List'

// ponytail: the dev server applies db/schema.sql only when it first connects, so re-apply this slice's
// index once per process; drop it once every environment has run the current schema.
let ready: Promise<unknown> | undefined
const ensureSchema = () => (ready ??= query('create unique index if not exists lists_one_default on lists (user_id) where is_default'))

export async function getLists(userId: string): Promise<List[]> {
  const rows = await query<{ id: string; name: string; is_default: boolean; created_at: Date; item_count: number }>(
    `select l.id, l.name, l.is_default, l.created_at, count(li.product_id)::int as item_count
     from lists l left join list_items li on li.list_id = l.id
     where l.user_id = $1
     group by l.id
     order by l.is_default desc, l.created_at`,
    [userId],
  )
  return rows.map((r) => ({ id: r.id, name: r.name, isDefault: r.is_default, itemCount: r.item_count, createdAt: new Date(r.created_at) }))
}

// Callers check the list belongs to the viewer (e.g. via getLists) before showing its items.
export async function listItems(listId: string): Promise<ListItem[]> {
  const rows = await query<{ product_id: number; added_at: Date }>('select product_id, added_at from list_items where list_id = $1 order by added_at desc', [listId])
  return rows.flatMap((r) => {
    const product = getProduct(r.product_id)
    return product ? [{ product, addedAt: new Date(r.added_at) }] : []
  })
}

export async function defaultList(userId: string) {
  await ensureSchema()
  const find = () => one<{ id: string; name: string }>('select id, name from lists where user_id = $1 and is_default', [userId])
  const list =
    (await find()) ??
    (await one<{ id: string; name: string }>('insert into lists (user_id, name, is_default) values ($1, $2, true) on conflict do nothing returning id, name', [userId, DEFAULT_LIST_NAME])) ??
    (await find()) // lost a race with a concurrent insert: the unique index kept one
  if (!list) throw new Error('Could not create the default list')
  return list
}

export async function createList(userId: string, name: string) {
  return (await one<{ id: string; name: string }>('insert into lists (user_id, name) values ($1, $2) returning id, name', [userId, name]))!
}

// Adds to one of the shopper's lists (default when listId is omitted). null when the list isn't theirs.
export async function addToList(userId: string, productId: number, listId?: string) {
  const list = listId ? await one<{ id: string; name: string }>('select id, name from lists where id = $1 and user_id = $2', [listId, userId]) : await defaultList(userId)
  if (!list) return null
  const row = await one('insert into list_items (list_id, product_id) values ($1, $2) on conflict do nothing returning list_id', [list.id, productId])
  return { ...list, added: !!row }
}
