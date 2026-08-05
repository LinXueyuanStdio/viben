"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { UserX, Crown, Shield } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Member {
  userId: string
  userSlug: string
  displayName: string
  avatarUrl: string | null
  role: string
  joinedAt: string | Date
}

interface TeamMembersListProps {
  teamSlug: string
  members: Member[]
  currentUserRole: string | null
}

export function TeamMembersList({ teamSlug, members, currentUserRole }: TeamMembersListProps) {
  const router = useRouter()
  const isOwner = currentUserRole === "owner"

  const handleRemove = async (userSlug: string, displayName: string) => {
    if (!confirm(`Remove ${displayName} from the team?`)) return
    const res = await fetch(`/api/teams/${teamSlug}/members/${userSlug}`, { method: "DELETE" })
    if (res.ok) router.refresh()
  }

  const handleRoleChange = async (userSlug: string, newRole: string) => {
    const res = await fetch(`/api/teams/${teamSlug}/members/${userSlug}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Members ({members.length})</h2>
      </div>

      <div className="divide-y border rounded-lg">
        {members.map((member) => (
          <div key={member.userId} className="flex items-center gap-4 px-4 py-3">
            <Link href={`/${member.userSlug}`} className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.avatarUrl ?? undefined} />
                <AvatarFallback>{member.displayName[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{member.displayName}</p>
                <p className="text-xs text-muted-foreground">@{member.userSlug}</p>
              </div>
            </Link>

            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-secondary font-medium">
              {member.role === "owner" ? (
                <span className="flex items-center gap-1">
                  <Crown className="h-3 w-3" /> Owner
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Member
                </span>
              )}
            </span>

            {isOwner && member.role !== "owner" && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRoleChange(member.userSlug, "owner")}
                >
                  Make Owner
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleRemove(member.userSlug, member.displayName)}>
                  <UserX className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            )}

            {isOwner && member.role === "owner" && members.filter(m => m.role === "owner").length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRoleChange(member.userSlug, "member")}
              >
                Revoke Owner
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
