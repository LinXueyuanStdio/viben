"use client"

import { useState, useEffect, useCallback } from "react"
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
    return null
  }

  // 2 段：可能是 /{user}/{page} 或 /{team}/{project} — 需要 API 查询
  if (parts.length === 2) {
    return null
  }

  // 1 段：可能是 /{user} 或 /{team} — 需要 API 查询
  if (parts.length === 1) {
    return null
  }

  return null
}

// ---- Level 2: 客户端内存缓存 ----

const resolutionCache = new Map<string, RouteResolution>()

// ---- Level 2.5: sessionStorage 持久化（跨硬导航复用） ----

const SESSION_STORAGE_KEY = "viben-route-resolutions"
// 递增版本号可在 schema 变更时让旧缓存自然失效
const CACHE_VERSION = 1

interface SessionCacheEntry {
  version: number
  resolutions: Record<string, RouteResolution>
}

function readSessionCache(): Record<string, RouteResolution> {
  if (typeof window === "undefined") return {}
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return {}
    const entry: SessionCacheEntry = JSON.parse(raw)
    if (entry.version !== CACHE_VERSION) return {}
    return entry.resolutions ?? {}
  } catch {
    return {}
  }
}

function writeSessionCache(resolutions: Record<string, RouteResolution>) {
  if (typeof window === "undefined") return
  try {
    const entry: SessionCacheEntry = { version: CACHE_VERSION, resolutions }
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(entry))
  } catch {
    // sessionStorage 满或不可用，静默忽略
  }
}

// 初始化时从 sessionStorage 恢复到内存 Map
let sessionCacheInitialized = false
function initFromSessionCache() {
  if (sessionCacheInitialized) return
  sessionCacheInitialized = true
  const stored = readSessionCache()
  for (const [key, value] of Object.entries(stored)) {
    if (!resolutionCache.has(key)) {
      resolutionCache.set(key, value as RouteResolution)
    }
  }
}

function persistToSessionCache(pathname: string, resolution: RouteResolution) {
  const stored = readSessionCache()
  stored[pathname] = resolution
  // 最多保留 200 条，防止无限增长
  const keys = Object.keys(stored)
  if (keys.length > 200) {
    for (const k of keys.slice(0, keys.length - 200)) {
      delete stored[k]
    }
  }
  writeSessionCache(stored)
}

export function getCachedResolution(pathname: string): RouteResolution | undefined {
  initFromSessionCache()
  return resolutionCache.get(pathname)
}

function setCachedResolution(pathname: string, resolution: RouteResolution) {
  resolutionCache.set(pathname, resolution)
  // 只持久化非 trivial 类型（需要服务端解析的），已知模式不需要
  if (resolution.type !== "home" && resolution.type !== "dashboard") {
    persistToSessionCache(pathname, resolution)
  }
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
 * 2. 客户端内存 Map 缓存 → sessionStorage 恢复
 * 3. sessionStorage 持久化（跨硬导航复用）
 * 4. 服务端 API → React.cache() 去重 → DB
 *
 * 返回 null 表示仍在加载中。
 */
export function useRouteResolution(): RouteResolution | null {
  const pathname = usePathname()
  const [resolution, setResolution] = useState<RouteResolution | null>(() => {
    // Level 1: 已知模式
    const known = matchKnownPatterns(pathname)
    if (known) return known
    // Level 2 + 2.5: 客户端缓存（内存 Map + sessionStorage）
    initFromSessionCache()
    return resolutionCache.get(pathname) ?? null
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
      setCachedResolution(pathname, result)
      setResolution(result)
    })
    return () => { cancelled = true }
  }, [pathname])

  return resolution
}
