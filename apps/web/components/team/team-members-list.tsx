"use client"

import { useState, useEffect, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { UserX, Crown, Shield, UserPlus, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"

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
  total: number
  page: number
  pageSize: number
}

export function TeamMembersList({
  teamSlug, members, currentUserRole, total, page, pageSize,
}: TeamMembersListProps) {
  const router = useRouter()
  const isOwner = currentUserRole === "owner"
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{ userSlug: string; displayName: string; avatarUrl: string | null }>>([])
  const [searching, setSearching] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.users?.filter((u: { userSlug: string }) =>
          !members.some((m) => m.userSlug === u.userSlug)
        ) ?? [])
      }
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }, [members])

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchUsers])

  const inviteMember = async (userSlug: string) => {
    setInviting(userSlug)
    try {
      const res = await fetch(`/api/teams/${teamSlug}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_slug: userSlug }),
      })
      if (res.ok) {
        toast.success("Member invited")
        setSearchResults((prev) => prev.filter((u) => u.userSlug !== userSlug))
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error ?? "Failed to invite")
      }
    } catch {
      toast.error("Failed to invite")
    } finally {
      setInviting(null)
    }
  }

  const handleRemove = async (userSlug: string, displayName: string) => {
    if (!confirm(`Remove ${displayName} from the team?`)) return
    const res = await fetch(`/api/teams/${teamSlug}/members/${userSlug}`, { method: "DELETE" })
    if (res.ok) router.refresh()
    else toast.error("Failed to remove member")
  }

  const handleRoleChange = async (userSlug: string, newRole: string) => {
    const res = await fetch(`/api/teams/${teamSlug}/members/${userSlug}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) router.refresh()
    else toast.error("Failed to change role")
  }

  const goToPage = (p: number) => {
    router.push(`/team/${teamSlug}/members?page=${p}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Members ({total})</h2>
        {isOwner && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-1.5 h-4 w-4" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Search by username to add members to this team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {searching && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                )}
                {searchResults.map((user) => (
                  <div key={user.userSlug} className="flex items-center gap-3 py-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{user.userSlug}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={inviting === user.userSlug}
                      onClick={() => inviteMember(user.userSlug)}
                    >
                      {inviting === user.userSlug ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : "Invite"}
                    </Button>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
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
                  variant="ghost" size="sm"
                  onClick={() => handleRoleChange(member.userSlug, "owner")}
                >
                  Make Owner
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleRemove(member.userSlug, member.displayName)}>
                  <UserX className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            )}

            {isOwner && member.role === "owner" && members.filter((m) => m.role === "owner").length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => handleRoleChange(member.userSlug, "member")}>
                Revoke Owner
              </Button>
            )}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline" size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline" size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
