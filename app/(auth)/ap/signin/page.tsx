import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { getUser, safeReturnTo } from '@/lib/auth'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignInPage({ searchParams }: PageProps<'/ap/signin'>) {
  const returnTo = safeReturnTo((await searchParams).return_to)
  if (await getUser()) redirect(returnTo)
  return <AuthForm returnTo={returnTo} start="email" />
}
