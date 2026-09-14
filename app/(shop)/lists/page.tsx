import type { Metadata } from 'next'
import { ListsView } from '@/components/lists/lists-view'
import { requireUser } from '@/lib/auth'
import { defaultList, getLists } from '@/lib/lists'

export const metadata: Metadata = { title: 'Your Lists' }

export default async function ListsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const create = (await searchParams).create === '1'
  const user = await requireUser(create ? '/lists?create=1' : '/lists')
  await defaultList(user.id) // everyone lands on a "Shopping List", created on first visit like on first save
  const lists = await getLists(user.id)
  return <ListsView lists={lists} active={lists[0]} path="/lists" create={create} />
}
