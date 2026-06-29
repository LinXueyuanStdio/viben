"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { UserPlus, UserCheck } from "lucide-react"

interface FollowButtonProps {
  userSlug: string
  className?: string
}

export function FollowButton({ userSlug, className }: FollowButtonProps) {
  const { t } = useTranslation()
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
          {t("community.following")}
        </>
      ) : (
        <>
          <UserPlus className="size-[14px]" />
          {t("community.follow")}
        </>
      )}
    </Button>
  )
}
