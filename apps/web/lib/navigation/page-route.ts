import { isReservedSlug } from "@/lib/utils/user-slug"

/**
 * 通过 URL pathname 同步判定是否为 published page 路由。
 * 0ms，客户端首帧执行，无需服务端数据。
 */
export function isPublishedPageRoute(pathname: string): {
  isPage: boolean
  userSlug?: string
  pageId?: string
} {
  const parts = pathname.split("/").filter(Boolean)

  if (parts.length !== 2) return { isPage: false }

  const [first, second] = parts

  if (first.startsWith("@")) return { isPage: false }

  if (isReservedSlug(first)) return { isPage: false }

  if (!second) return { isPage: false }

  return { isPage: true, userSlug: decodeURIComponent(first), pageId: decodeURIComponent(second) }
}
