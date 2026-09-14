'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProduct } from '@/lib/catalog'
import { addToList as addItem, createList } from '@/lib/lists'

export type AddToListState = { ok: true; listId: string; listName: string; added: boolean } | { ok: false; error: string; field?: 'name' } | null

const PROBLEM = 'There was a problem adding this item to your list. Please try again.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Fields: productId; optional listId (an existing list) or newList (name of a list to create first).
export async function addToList(_prev: AddToListState, form: FormData): Promise<AddToListState> {
  const p = getProduct(Number(form.get('productId')))
  if (!p) return { ok: false, error: PROBLEM }
  const user = await getUser()
  if (!user) redirect(`/ap/signin?return_to=${encodeURIComponent(`/dp/${p.id}`)}`)

  const newList = form.get('newList')
  const listIdField = form.get('listId')
  let listId: string | undefined
  if (typeof newList === 'string') {
    const name = newList.trim()
    if (!name) return { ok: false, field: 'name', error: 'Please enter a list name' }
    if (name.length > 50) return { ok: false, field: 'name', error: 'List name is too long' }
    listId = (await createList(user.id, name)).id
  } else if (typeof listIdField === 'string' && listIdField) {
    if (!UUID.test(listIdField)) return { ok: false, error: PROBLEM }
    listId = listIdField
  }

  const result = await addItem(user.id, p.id, listId)
  if (!result) return { ok: false, error: PROBLEM }
  refresh()
  return { ok: true, listId: result.id, listName: result.name, added: result.added }
}
