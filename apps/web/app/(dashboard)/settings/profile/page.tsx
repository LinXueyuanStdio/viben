import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { ProfileSettingsForm } from '@/components/profile/profile-settings-form'

export const dynamic = 'force-dynamic'

export default async function SettingsProfilePage() {
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
    <ProfileSettingsForm
      user={{
        id: user.id,
        userSlug: user.userSlug,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        websiteUrl: user.websiteUrl,
      }}
    />
  )
}
