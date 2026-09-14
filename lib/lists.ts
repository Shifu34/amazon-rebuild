// Shopping lists. Every shopper has at most one default list ("Shopping List"), created the first time they save something.
// List names are unique per shopper (ignoring case). Every write checks ownership in SQL; list ids are compared as text
// so a malformed id simply matches nothing.
import { getProduct, type Product } from './catalog'
import { one, query } from './db'

export type List = { id: string; name: string; isDefault: boolean; itemCount: number; createdAt: Date }
export type ListItem = { product: Product; addedAt: Date }

export const DEFAULT_LIST_NAME = 'Shopping List'
export const DUPLICATE_LIST = 'You already have a list with this name. Please choose a different name.'

export const cleanListName = (raw: unknown) => String(raw ?? '').trim().replace(/\s+/g, ' ')
export const listNameError = (name: string) => (!name ? 'Please enter a list name' : name.length > 50 ? 'List name is too long' : null)

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

// null when the shopper already has a list with this name
export async function createList(userId: string, name: string) {
  const row = await one<{ id: string; name: string }>(
    `insert into lists (user_id, name) select $1::uuid, $2::text
     where not exists (select 1 from lists where user_id = $1::uuid and lower(name) = lower($2::text))
     returning id, name`,
    [userId, name],
  )
  return row ?? null
}

// Default lists keep their name. 'duplicate' when another of the shopper's lists has the name, 'missing' when not theirs.
export async function renameList(userId: string, listId: string, name: string): Promise<'ok' | 'duplicate' | 'missing'> {
  const row = await one<{ renamed: boolean; duplicate: boolean }>(
    `with dup as (select 1 from lists where user_id = $1::uuid and lower(name) = lower($3::text) and id::text <> $2::text),
     renamed as (
       update lists set name = $3::text where user_id = $1::uuid and id::text = $2::text and not is_default and not exists (select 1 from dup)
       returning id
     )
     select exists (select 1 from renamed) as renamed, exists (select 1 from dup) as duplicate`,
    [userId, listId, name],
  )
  return row?.renamed ? 'ok' : row?.duplicate ? 'duplicate' : 'missing'
}

// items go with the list (on delete cascade); the default list can't be deleted
export async function deleteList(userId: string, listId: string) {
  await query('delete from lists where user_id = $1::uuid and id::text = $2::text and not is_default', [userId, listId])
}

// Adds to one of the shopper's lists (default when listId is omitted). null when the list isn't theirs.
export async function addToList(userId: string, productId: number, listId?: string) {
  const list = listId ? await one<{ id: string; name: string }>('select id, name from lists where id = $1 and user_id = $2', [listId, userId]) : await defaultList(userId)
  if (!list) return null
  const row = await one('insert into list_items (list_id, product_id) values ($1, $2) on conflict do nothing returning list_id', [list.id, productId])
  return { ...list, added: !!row }
}

// Returns when the item was added (so Undo can put it back in place), or null if it wasn't on the shopper's list.
export async function removeListItem(userId: string, listId: string, productId: number) {
  const row = await one<{ added_at: Date }>(
    `delete from list_items li using lists l
     where li.list_id = l.id and l.user_id = $1::uuid and l.id::text = $2::text and li.product_id = $3::int
     returning li.added_at`,
    [userId, listId, productId],
  )
  return row ? new Date(row.added_at) : null
}

export async function restoreListItem(userId: string, listId: string, productId: number, addedAt: Date) {
  await query(
    `insert into list_items (list_id, product_id, added_at)
     select id, $3::int, $4::timestamptz from lists where user_id = $1::uuid and id::text = $2::text
     on conflict do nothing`,
    [userId, listId, productId, addedAt],
  )
}

// One statement: take the item off one of the shopper's lists and onto another, keeping its added date.
// Returns the destination list, or null when either list isn't theirs or the item wasn't there.
export async function moveListItem(userId: string, fromListId: string, toListId: string, productId: number) {
  const row = await one<{ id: string; name: string }>(
    `with dst as (select id, name from lists where user_id = $1::uuid and id::text = $3::text and id::text <> $2::text),
     moved as (
       delete from list_items li using lists l
       where li.list_id = l.id and l.user_id = $1::uuid and l.id::text = $2::text and li.product_id = $4::int and exists (select 1 from dst)
       returning li.added_at
     ),
     ins as (
       insert into list_items (list_id, product_id, added_at) select dst.id, $4::int, moved.added_at from dst, moved
       on conflict do nothing
     )
     select dst.id, dst.name from dst where exists (select 1 from moved)`,
    [userId, fromListId, toListId, productId],
  )
  return row ?? null
}
