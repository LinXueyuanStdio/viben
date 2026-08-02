"use client"

import { useState, useMemo } from "react"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileContentItem, type ProfileContentItemData } from "./profile-content-item"
import { SectionHead } from "@/components/content/section-head"
import { EmptyState } from "@/components/content/i18n-text"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type FavoriteCategory = "pages" | "mcp" | "skill"

interface BookmarkedMcpSkill {
  id: string
  type: "mcp" | "skill"
  name: string
  slug: string
  version: string
  description: string | null
  transport?: string
  skillType?: string
  author: { username: string; avatarUrl: string | null } | null
  favoritedAt: Date
}

interface CollectionInfo {
  id: string
  name: string
  itemCount: number
}

interface ProfileLikesMergedProps {
  likedPages: (ProfileContentItemData & { pageUid: string })[]
  bookmarkedPages: (ProfileContentItemData & { pageUid: string })[]
  bookmarkedMcps: BookmarkedMcpSkill[]
  bookmarkedSkills: BookmarkedMcpSkill[]
  collections: CollectionInfo[]
  userSlug: string
  isOwnProfile: boolean
}

export function ProfileLikesMerged({
  likedPages,
  bookmarkedPages,
  bookmarkedMcps,
  bookmarkedSkills,
  collections,
  userSlug,
  isOwnProfile,
}: ProfileLikesMergedProps) {
  const router = useRouter()
  const [category, setCategory] = useState<FavoriteCategory>("pages")
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)

  // Build collection list: "全部收藏" + user collections
  const collectionList = useMemo<{ id: string | null; name: string; itemCount: number }[]>(() => [
    { id: null, name: "全部收藏", itemCount: 0 },
    ...collections,
  ], [collections])

  // Map bookmarked MCP/skill items to content item data
  const mcpContentItems = useMemo(() =>
    bookmarkedMcps.map((m) => ({
      coverUrl: null as string | null,
      title: m.name,
      description: m.description ?? undefined,
      author: {
        name: m.author?.username ?? "?",
        avatarUrl: m.author?.avatarUrl ?? undefined,
      },
      badges: [`v${m.version}`, m.transport?.toUpperCase() ?? ""].filter(Boolean),
      stats: undefined,
      _href: `/mcp-market/${m.id}`,
      _id: m.id,
      _type: "mcp" as const,
    })), [bookmarkedMcps])

  const skillContentItems = useMemo(() =>
    bookmarkedSkills.map((s) => ({
      coverUrl: null as string | null,
      title: s.name,
      description: s.description ?? undefined,
      author: {
        name: s.author?.username ?? "?",
        avatarUrl: s.author?.avatarUrl ?? undefined,
      },
      badges: [`v${s.version}`, s.skillType ?? ""].filter(Boolean),
      stats: undefined,
      _href: `/skill-market/${s.id}`,
      _id: s.id,
      _type: "skill" as const,
    })), [bookmarkedSkills])

  // Content for each category
  const favoriteContent = useMemo(() => {
    switch (category) {
      case "pages":
        return bookmarkedPages.map((p) => ({ ...p, _href: `/${encodeURIComponent(userSlug)}/${encodeURIComponent(p.pageUid)}?tab=read` }))
      case "mcp":
        return mcpContentItems
      case "skill":
        return skillContentItems
    }
  }, [category, bookmarkedPages, mcpContentItems, skillContentItems, userSlug])

  const handleDelete = async (id: string, type: "mcp" | "skill") => {
    const apiPath = type === "mcp"
      ? `/api/mcp/${id}/bookmark`
      : `/api/skill/${id}/favorite`
    try {
      const res = await fetch(apiPath, { method: "POST" })
      if (res.ok) {
        toast.success("已取消收藏")
        router.refresh()
      } else {
        toast.error("操作失败")
      }
    } catch {
      toast.error("操作失败")
    }
  }

  return (
    <div className="space-y-6">
      {/* ====== 收藏区 ====== */}
      <section>
        <SectionHead title="收藏" />
        <div className="rounded-[12px] border border-border bg-card overflow-hidden">
          {/* Category tabs */}
          <div className="border-b border-border px-4 pt-3">
            <Tabs value={category} onValueChange={(v) => { setCategory(v as FavoriteCategory); setSelectedCollectionId(null) }}>
              <TabsList>
                <TabsTrigger value="pages" className="text-xs">页面</TabsTrigger>
                <TabsTrigger value="mcp" className="text-xs">MCP</TabsTrigger>
                <TabsTrigger value="skill" className="text-xs">技能</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Body: left sidebar + right content */}
          <div className="flex" style={{ minHeight: 300 }}>
            {/* Left: collection list */}
            <div className="w-[180px] border-r border-border p-2 shrink-0">
              <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                {collectionList.map((col) => (
                  <button
                    key={col.id ?? "__all__"}
                    onClick={() => setSelectedCollectionId(col.id)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",
                      selectedCollectionId === col.id
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
                    )}
                  >
                    {col.name}
                    {col.itemCount > 0 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{col.itemCount}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: content list */}
            <div className="flex-1 p-3 min-w-0">
              {favoriteContent.length === 0 ? (
                <div className="flex items-center justify-center h-full py-12">
                  <EmptyState tKey="profile.noFavorites" fallback="暂无收藏内容" />
                </div>
              ) : (
                <div className="grid gap-2">
                  {favoriteContent.map((item, i) => {
                    const href = (item as Record<string, unknown>)._href as string | undefined
                    const itemId = (item as Record<string, unknown>)._id as string | undefined
                    const itemType = (item as Record<string, unknown>)._type as "mcp" | "skill" | undefined

                    const moreMenuItems = (isOwnProfile && itemId && itemType)
                      ? [{
                          label: "取消收藏",
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => handleDelete(itemId, itemType),
                          destructive: true as const,
                        }]
                      : undefined

                    return (
                      <ProfileContentItem
                        key={i}
                        data={item}
                        href={href}
                        moreMenuItems={moreMenuItems}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ====== 喜欢区 ====== */}
      <section>
        <SectionHead title="喜欢" />
        {likedPages.length === 0 ? (
          <EmptyState tKey="community.noLikedPages" fallback="暂无喜欢的页面" />
        ) : (
          <div className="grid gap-2">
            {likedPages.map((item) => (
              <ProfileContentItem
                key={item.pageUid}
                data={item}
                href={`/${encodeURIComponent(userSlug)}/${encodeURIComponent(item.pageUid)}?tab=read`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
