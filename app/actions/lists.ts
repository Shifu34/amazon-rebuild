'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { getProduct } from '@/lib/catalog'
import * as lists from '@/lib/lists'
import { cleanListName, DUPLICATE_LIST, listNameError } from '@/lib/lists'

export type AddToListState = { ok: true; listId: string; listName: string; added: boolean } | { ok: false; error: string; field?: 'name' } | null
export type ListFormState = { ok: true } | { ok: false; error: string } | null

const PROBLEM = 'There was a problem adding this item to your list. Please try again.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const text = (form: FormData, name: string) => String(form.get(name) ?? '')
const productIdOf = (form: FormData) => {
  const id = Number(form.get('productId'))
  return Number.isInteger(id) && id > 0 ? id : null
}

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
    const name = cleanListName(newList)
    const error = listNameError(name)
    if (error) return { ok: false, field: 'name', error }
    const created = await lists.createList(user.id, name)
    if (!created) return { ok: false, field: 'name', error: DUPLICATE_LIST }
    listId = created.id
  } else if (typeof listIdField === 'string' && listIdField) {
    if (!UUID.test(listIdField)) return { ok: false, error: PROBLEM }
    listId = listIdField
  }

  const result = await lists.addToList(user.id, p.id, listId)
  if (!result) return { ok: false, error: PROBLEM }
  refresh()
  return { ok: true, listId: result.id, listName: result.name, added: result.added }
}

// "Create a List" dialog on /lists. Field: name. Opens the new list.
export async function createNamedList(_prev: ListFormState, form: FormData): Promise<ListFormState> {
  const user = await getUser()
  if (!user) redirect('/ap/signin?return_to=%2Flists%3Fcreate%3D1')
  const name = cleanListName(form.get('name'))
  const error = listNameError(name)
  if (error) return { ok: false, error }
  const list = await lists.createList(user.id, name)
  if (!list) return { ok: false, error: DUPLICATE_LIST }
  redirect(`/lists/${list.id}`)
}

// Fields: listId, name. Default lists can't be renamed.
export async function renameList(_prev: ListFormState, form: FormData): Promise<ListFormState> {
  const user = await getUser()
  if (!user) return { ok: false, error: 'Your session has ended. Please sign in again.' }
  const name = cleanListName(form.get('name'))
  const error = listNameError(name)
  if (error) return { ok: false, error }
  const result = await lists.renameList(user.id, text(form, 'listId'), name)
  if (result === 'duplicate') return { ok: false, error: DUPLICATE_LIST }
  if (result === 'missing') return { ok: false, error: "We couldn't find that list. It may have been deleted." }
  refresh()
  return { ok: true }
}

// Field: listId. Back to the default list afterwards.
export async function deleteList(form: FormData) {
  const user = await getUser()
  if (user) await lists.deleteList(user.id, text(form, 'listId'))
  redirect('/lists')
}

// Fields: listId, productId. Returns the original added date for Undo, or null if nothing was removed.
export async function removeListItem(form: FormData): Promise<{ addedAt: string } | null> {
  const user = await getUser()
  const productId = productIdOf(form)
  if (!user || !productId) return null
  const addedAt = await lists.removeListItem(user.id, text(form, 'listId'), productId)
  refresh()
  return addedAt && { addedAt: addedAt.toISOString() }
}

// Fields: listId, productId, addedAt (from removeListItem).
export async function restoreListItem(form: FormData) {
  const user = await getUser()
  const productId = productIdOf(form)
  if (!user || !productId) return
  const addedAt = new Date(text(form, 'addedAt'))
  await lists.restoreListItem(user.id, text(form, 'listId'), productId, Number.isNaN(addedAt.getTime()) ? new Date() : addedAt)
  refresh()
}

// Fields: listId, toListId, productId. Returns the destination list, or null.
export async function moveListItem(form: FormData): Promise<{ id: string; name: string } | null> {
  const user = await getUser()
  const productId = productIdOf(form)
  if (!user || !productId) return null
  const moved = await lists.moveListItem(user.id, text(form, 'listId'), text(form, 'toListId'), productId)
  refresh()
  return moved
}
