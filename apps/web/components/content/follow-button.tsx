"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { UserPlus, UserCheck } from "lucide-react"

interface FollowButtonProps {
  userSlug: string
  className?: string
}

export function FollowButton({ userSlug, className }: FollowButtonProps) {
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleFollow = async () => {
    setLoading(true)
    try {
      const method = following ? "DELETE" : "POST"
      const res = await fetch(`/api/users/${encodeURIComponent(userSlug)}/follow`, { method })
      if (res.ok) {
        setFollowing(!following)
      }
    } catch {
      // silently ignore network errors
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={handleFollow}
      disabled={loading}
    >
      {following ? (
        <>
          <UserCheck className="size-[14px]" />
          已关注
        </>
      ) : (
        <>
          <UserPlus className="size-[14px]" />
          关注
        </>
      )}
    </Button>
  )
}
