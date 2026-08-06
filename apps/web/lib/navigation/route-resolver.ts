"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { routeRegistry } from "./route-registry"

// ---- 类型 ----

export type ResolutionType =
  | "home"
  | "dashboard"
  | "user-overview"
  | "read-page"
  | "team-overview"
  | "team-sub"
  | "project-overview"
  | "project-page"
  | "not-found"

export interface RouteResolution {
  type: ResolutionType
  teamSlug?: string
  teamDisplayName?: string
  projectSlug?: string
  projectDisplayName?: string
  pageSlug?: string
  userSlug?: string
  userDisplayName?: string
}

// ---- Level 1: URL 模式匹配（同步 0ms） ----

const KNOWN_FIRST_SEGMENTS = new Set([
  "moment", "leaderboard", "category", "search", "tags",
  "settings", "admin", "assistant", "pages", "collections",
  "market", "mcp-market", "skill-market", "publish",
  "notifications", "history", "code-stats", "home", "web",
  "docs", "login", "register",
])

const TEAM_SUB_SEGMENTS = new Set(["projects", "members", "settings", "new", "invite"])

export function matchKnownPatterns(pathname: string): RouteResolution | null {
  const parts = pathname.split("/").filter(Boolean)

  if (parts.length === 0) return { type: "home" }

  const first = parts[0]

  // /team/{slug}/... 模式
  if (first === "team") {
    if (parts.length >= 3) {
      const teamSlug = parts[1]
      // /team/{slug}/projects/{projectSlug}/... 项目上下文
      if (parts[2] === "projects" && parts.length >= 4 && parts[3] !== "new") {
        return { type: "project-overview", teamSlug, projectSlug: parts[3] }
      }
      return { type: "team-sub", teamSlug }
    }
    if (parts.length === 2) {
      return { type: "team-overview", teamSlug: parts[1] }
    }
    return { type: "dashboard" }
  }

  // 已知静态路由
  if (KNOWN_FIRST_SEGMENTS.has(first) || routeRegistry[`/${first}`]) {
    return { type: "dashboard" }
  }

  // 3 段：可能是 /{team}/{project}/{page} — 需要 API 查询
  if (parts.length === 3) {
    return null // 需要服务端解析
  }

  // 2 段：可能是 /{user}/{page} 或 /{team}/{project} — 需要 API 查询
  if (parts.length === 2) {
    return null // 需要服务端解析
  }

  // 1 段：可能是 /{user} 或 /{team} — 需要 API 查询
  if (parts.length === 1) {
    return null // 需要服务端解析
  }

  return null
}

// ---- Level 2: 客户端内存缓存 ----

const resolutionCache = new Map<string, RouteResolution>()

export function getCachedResolution(pathname: string): RouteResolution | undefined {
  return resolutionCache.get(pathname)
}

// ---- Level 3: 服务端 API ----

async function resolveFromServer(pathname: string): Promise<RouteResolution> {
  const parts = pathname.split("/").filter(Boolean)
  const slugs = parts.map(encodeURIComponent).join(",")

  try {
    const res = await fetch(`/api/rpc/resolve-route?slugs=${slugs}`)
    if (!res.ok) return { type: "not-found" }
    const data = await res.json()
    return data as RouteResolution
  } catch {
    return { type: "not-found" }
  }
}

// ---- React Hook ----

/**
 * 统一路由解析 hook — 多级缓存架构：
 * 1. 已知模式匹配（同步 0ms）
 * 2. 客户端内存缓存
 * 3. 服务端 API → React.cache() 去重 → DB
 *
 * 返回 null 表示仍在加载中。
 */
export function useRouteResolution(): RouteResolution | null {
  const pathname = usePathname()
  const [resolution, setResolution] = useState<RouteResolution | null>(() => {
    // Level 1: 已知模式
    const known = matchKnownPatterns(pathname)
    if (known) return known
    // Level 2: 客户端缓存
    return getCachedResolution(pathname) ?? null
  })

  useEffect(() => {
    // 每次 pathname 变化时重新检查
    const known = matchKnownPatterns(pathname)
    if (known) {
      setResolution(known)
      return
    }
    const cached = getCachedResolution(pathname)
    if (cached) {
      setResolution(cached)
      return
    }
    // Level 3: 异步服务端解析
    let cancelled = false
    setResolution(null) // loading
    resolveFromServer(pathname).then((result) => {
      if (cancelled) return
      resolutionCache.set(pathname, result)
      setResolution(result)
    })
    return () => { cancelled = true }
  }, [pathname])

  return resolution
}
