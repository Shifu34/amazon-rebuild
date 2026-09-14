import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ListsView } from '@/components/lists/lists-view'
import { requireUser } from '@/lib/auth'
import { getLists } from '@/lib/lists'

export const metadata: Metadata = { title: 'Your Lists' }

export default async function ListPage({ params, searchParams }: { params: Promise<{ listId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ listId }, { create }] = await Promise.all([params, searchParams])
  const user = await requireUser(`/lists/${listId}`)
  const lists = await getLists(user.id)
  const active = lists.find((l) => l.id === listId) // another shopper's list is the same 404 as a missing one
  if (!active) notFound()
  return <ListsView lists={lists} active={active} path={`/lists/${active.id}`} create={create === '1'} />
}
