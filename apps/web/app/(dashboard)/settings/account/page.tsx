import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { AccountSettingsForm } from '@/components/profile/account-settings-form'

export const dynamic = 'force-dynamic'

export default async function SettingsAccountPage() {
  const session = await getSession()

  if (!session?.userId) {
    redirect('/login')
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  })

  if (!user) {
    redirect('/login')
  }

  return (
    <AccountSettingsForm
      user={{
        id: user.id,
        username: user.username,
        email: user.email,
        hasPassword: !!user.passwordHash,
      }}
    />
  )
}
