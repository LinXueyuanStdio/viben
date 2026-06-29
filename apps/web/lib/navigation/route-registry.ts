import {
  Home,
  TrendingUp,
  Package,
  Sparkles,
  Layers,
  Grid3X3,
  MessageSquare,
  Bell,
  Clock,
  Upload,
  PackageSearch,
  BarChart3,
  Search,
  User,
  type LucideIcon,
} from "lucide-react"

export interface RouteConfig {
  label: string
  titleKey?: string       // i18n key，优先于 label
  icon: LucideIcon
  dropdownCategory?: string // 下拉菜单分组
  parent?: string           // 父路由路径
  mode?: "global" | "author" | "read"
}

/** 全局路由注册表 — 路径→配置映射 */
export const routeRegistry: Record<string, RouteConfig> = {
  // 根路由
  "/": { label: "首页", icon: Home },

  // 社区浏览
  "/leaderboard": { label: "榜单", icon: TrendingUp, parent: "/", dropdownCategory: "浏览" },
  "/moment": { label: "动态", icon: MessageSquare, parent: "/", dropdownCategory: "浏览" },
  "/category": { label: "分类", icon: Grid3X3, parent: "/", dropdownCategory: "浏览" },
  "/author": { label: "作者", icon: User, parent: "/", dropdownCategory: "浏览" },
  "/notifications": { label: "通知", icon: Bell, parent: "/", dropdownCategory: "浏览" },
  "/history": { label: "浏览历史", icon: Clock, parent: "/", dropdownCategory: "浏览" },
  "/search": { label: "搜索", icon: Search, parent: "/" },

  // 市场
  "/mcp": { label: "MCP 市场", icon: Package, parent: "/", dropdownCategory: "市场" },
  "/mcp-market": { label: "MCP 市场", icon: Package, parent: "/", dropdownCategory: "市场" },
  "/skills": { label: "技能市场", icon: Sparkles, parent: "/", dropdownCategory: "市场" },
  "/skill-market": { label: "技能市场", icon: Sparkles, parent: "/", dropdownCategory: "市场" },
  "/collections": { label: "合集", icon: Layers, parent: "/", dropdownCategory: "市场" },

  // 创作者
  "/publish": { label: "发布", icon: Upload, parent: "/", dropdownCategory: "创作" },
  "/my-packages": { label: "我的包", icon: PackageSearch, parent: "/", dropdownCategory: "创作" },
  "/analytics": { label: "分析", icon: BarChart3, parent: "/", dropdownCategory: "创作" },

  // 设置
  "/settings/favorites": { label: "收藏", icon: Sparkles, parent: "/", dropdownCategory: "我的" },
  "/settings/tokens": { label: "API 密钥", icon: Package, parent: "/", dropdownCategory: "我的" },

  // 管理员路由（仅 role=admin 可见）
  "/admin": {
    label: "管理后台",
    icon: BarChart3,
    parent: "/",
    dropdownCategory: "管理",
  },
  "/admin/packages": {
    label: "包审核",
    icon: Package,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/users": {
    label: "用户管理",
    icon: Sparkles,
    parent: "/admin",
    dropdownCategory: "管理",
  },

  // 阅读面包屑（模式=read 时使用）
  "/read": { label: "阅读", icon: Home, mode: "read" },
}

/** 获取面包屑段 */
export function resolveBreadcrumbSegments(
  pathname: string
): Array<{ href: string; config: RouteConfig; isLast: boolean }> {
  const segments: Array<{ href: string; config: RouteConfig; isLast: boolean }> = []
  const parts = pathname.split("/").filter(Boolean)
  let accumulated = ""

  for (let i = 0; i < parts.length; i++) {
    accumulated += "/" + parts[i]
    const config = routeRegistry[accumulated]
    const isLast = i === parts.length - 1

    if (config) {
      segments.push({ href: accumulated, config, isLast })
    } else if (!isLast) {
      // 中间段无注册表项——跳过，但要推进路径
      continue
    } else {
      // 最末段无注册——用路径末段作为 label
      segments.push({
        href: accumulated,
        config: { label: parts[i], icon: Home },
        isLast: true,
      })
    }
  }

  // 如果没有匹配到任何段，至少有一个根
  if (segments.length === 0) {
    segments.push({
      href: "/",
      config: routeRegistry["/"],
      isLast: true,
    })
  }

  return segments
}

/** 获取同级路由（用于面包屑下拉菜单） */
export function getSiblingRoutes(parentPath: string): Array<{ href: string; config: RouteConfig }> {
  const siblings: Array<{ href: string; config: RouteConfig }> = []

  for (const [href, config] of Object.entries(routeRegistry)) {
    if (href === parentPath) continue // 不包括自己
    if (config.parent === parentPath || (!config.parent && parentPath === "/")) {
      siblings.push({ href, config })
    }
  }

  return siblings
}
