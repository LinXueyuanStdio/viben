"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { UserPlus, UserCheck } from "lucide-react"

interface FollowButtonProps {
  userSlug: string
  className?: string
  currentUserSlug?: string
}

export function FollowButton({ userSlug, className, currentUserSlug }: FollowButtonProps) {
  const { t } = useTranslation()
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(false)

  // 不能关注自己
  if (currentUserSlug && currentUserSlug === userSlug) {
    return null
  }

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
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
