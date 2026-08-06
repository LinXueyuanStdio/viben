"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, X, Search } from "lucide-react"

interface UserResult {
  userSlug: string
  displayName: string
  avatarUrl: string | null
}

export default function InviteMembersPage({
  params,
}: {
  params: Promise<{ team_slug: string }>
}) {
  const router = useRouter()
  const [teamSlug, setTeamSlug] = useState("")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserResult[]>([])
  const [selected, setSelected] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    params.then((p) => setTeamSlug(p.team_slug))
  }, [params])

  const handleSearch = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(value)}`)
        if (res.ok) {
          const data = await res.json()
          const filtered = (data.users || []).filter(
            (u: UserResult) => !selected.some((s) => s.userSlug === u.userSlug)
          )
          setResults(filtered.slice(0, 10))
        }
      } catch {
        // ignore
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [selected])

  const addUser = useCallback((user: UserResult) => {
    setSelected((prev) => [...prev, user])
    setResults((prev) => prev.filter((r) => r.userSlug !== user.userSlug))
    setQuery("")
  }, [])

  const removeUser = useCallback((userSlug: string) => {
    setSelected((prev) => prev.filter((u) => u.userSlug !== userSlug))
  }, [])

  const handleComplete = useCallback(async () => {
    if (!teamSlug) return
    setSubmitting(true)
    try {
      for (const user of selected) {
        await fetch(`/api/teams/${teamSlug}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_slug: user.userSlug }),
        })
      }
    } catch {
      // ignore
    }
    router.push(`/${teamSlug}`)
  }, [teamSlug, selected, router])

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-16">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Start collaborating</h2>
        <h1 className="text-3xl font-bold">Welcome to {teamSlug}</h1>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Add team members</h3>
          <p className="text-sm text-muted-foreground">
            Team members will be able to view projects.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by username, full name or email address"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {results.length > 0 && (
          <div className="border rounded-lg divide-y">
            {results.map((user) => (
              <button
                key={user.userSlug}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors text-left"
                onClick={() => addUser(user)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatarUrl ?? undefined} />
                  <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">@{user.userSlug}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {searching && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((user) => (
              <span
                key={user.userSlug}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-secondary px-3 py-1 text-sm"
              >
                {user.displayName}
                <button onClick={() => removeUser(user.userSlug)}>
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={handleComplete} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Complete Setup
        </Button>
        <Button variant="ghost" onClick={() => router.push(`/${teamSlug}`)}>
          Skip this step
        </Button>
      </div>
    </div>
  )
}
