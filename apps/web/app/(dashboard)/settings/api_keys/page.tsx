import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { ProfileApiKeys } from '@/components/profile/profile-api-keys'

export const dynamic = 'force-dynamic'

export default async function ApiKeysPage() {
  const session = await getSession()
  if (!session?.userId) redirect('/login')

  return <ProfileApiKeys />
}
