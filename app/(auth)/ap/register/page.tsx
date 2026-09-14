import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { getUser, safeReturnTo } from '@/lib/auth'

export const metadata: Metadata = { title: 'Create account' }

export default async function RegisterPage({ searchParams }: PageProps<'/ap/register'>) {
  const returnTo = safeReturnTo((await searchParams).return_to)
  if (await getUser()) redirect(returnTo)
  return <AuthForm returnTo={returnTo} start="create" />
}
