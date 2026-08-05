import { getSession } from "@/lib/auth/cookies"
import { redirect } from "next/navigation"
import { db, users, teamMembers } from "@/lib/db"
import { eq } from "drizzle-orm"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Settings, LogOut } from "lucide-react"

export default async function TeamsListPage() {
  const session = await getSession()
  if (!session?.userId) redirect("/login")

  const memberships = await db
    .select({
      teamId: teamMembers.teamId,
      teamSlug: users.userSlug,
      teamName: users.displayName,
      teamAvatarUrl: users.avatarUrl,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.teamId, users.id))
    .where(eq(teamMembers.userId, session.userId))
    .orderBy(teamMembers.joinedAt)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teams</h1>
        <Button asChild>
          <Link href="/account/teams/new">
            <Plus className="mr-1 h-4 w-4" />
            New Team
          </Link>
        </Button>
      </div>

      {memberships.length === 0 ? (
        <p className="text-muted-foreground">You are not a member of any team yet.</p>
      ) : (
        <div className="divide-y border rounded-lg">
          {memberships.map((m) => (
            <div key={m.teamId} className="flex items-center gap-4 px-4 py-3">
              <Link href={`/${m.teamSlug}`} className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={m.teamAvatarUrl ?? undefined} />
                  <AvatarFallback>{m.teamName[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.teamName}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.role === "owner" ? "Owner" : "Member"}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                {m.role === "owner" && (
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/team/${m.teamSlug}/settings`}>
                      <Settings className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/${m.teamSlug}`}>
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
