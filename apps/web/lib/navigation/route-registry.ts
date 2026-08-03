import {
  Home,
  FileText,
  TrendingUp,
  Package,
  Sparkles,
  Layers,
  Grid3X3,
  MessageSquare,
  Bell,
  Clock,
  Upload,
  BarChart3,
  Search,
  User,
  Heart,
  Key,
  Shield,
  Flag,
  ScrollText,
  Image,
  Link,
  Activity,
  Download,
  TrendingDown,
  Star,
  FileEdit,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react"

export interface RouteConfig {
  label: string
  titleKey?: string       // i18n key，优先于 label
  icon?: LucideIcon
  dropdownCategory?: string // 下拉菜单分组
  parent?: string           // 父路由路径
  mode?: "global" | "author" | "read"
}

/** 动态段标签映射：路径段 → {label, icon?, href?} */
export interface DynamicSegmentLabel {
  label: string
  icon?: LucideIcon
  href?: string  // 覆盖默认链接
}

/** 全局路由注册表 — 路径→配置映射 */
export const routeRegistry: Record<string, RouteConfig> = {
  // 根路由
  "/": { label: "首页", icon: Home },

  // 社区浏览
  "/leaderboard": { label: "榜单", icon: TrendingUp, parent: "/", dropdownCategory: "浏览" },
  "/moment": { label: "动态", icon: MessageSquare, parent: "/", dropdownCategory: "浏览" },
  "/category": { label: "分类", icon: Grid3X3, parent: "/", dropdownCategory: "浏览" },
  "/notifications": { label: "通知", icon: Bell, parent: "/", dropdownCategory: "浏览" },
  "/history": { label: "浏览历史", icon: Clock, parent: "/", dropdownCategory: "浏览" },
  "/search": { label: "搜索", icon: Search, parent: "/" },
  "/tags": { label: "标签", icon: Grid3X3, parent: "/", dropdownCategory: "浏览" },

  // 市场
  "/market": { label: "市场", icon: ShoppingBag, parent: "/", dropdownCategory: "市场" },
  "/mcp-market": { label: "MCP 市场", icon: Package, parent: "/", dropdownCategory: "市场" },
  "/skill-market": { label: "技能市场", icon: Sparkles, parent: "/", dropdownCategory: "市场" },

  // 创作者
  "/publish": { label: "发布", icon: Upload, parent: "/", dropdownCategory: "创作" },
  "/analytics": { label: "创作平台", icon: BarChart3, parent: "/", dropdownCategory: "创作" },

  // 市场详情（动态段父路由已注册，此处注册静态子页面）
  "/mcp-market/official": { label: "官方精选", icon: Package, parent: "/mcp-market" },
  "/skill-market/official": { label: "官方精选", icon: Sparkles, parent: "/skill-market" },

  // 个人（动态段路由 /[user_slug] 已存在，此处不再注册静态 /profile）

  // 合集
  "/collections": { label: "合集", icon: Layers, parent: "/" },

  // 创作
  "/pages": { label: "页面", icon: FileText, parent: "/" },
  "/pages/new": { label: "新建页面", icon: FileText, parent: "/publish" },
  "/pages/edit": { label: "编辑页面", icon: FileEdit, parent: "/pages" },

  // 设置
  "/settings": { label: "设置", titleKey: "common.settings", icon: User, parent: "/", dropdownCategory: "我的" },
  "/settings/profile": { label: "用户资料", titleKey: "profile.settings.nav.profile", icon: User, parent: "/settings" },
  "/settings/account": { label: "账户", titleKey: "profile.settings.nav.account", icon: Shield, parent: "/settings" },
  "/settings/api_keys": { label: "API 密钥", titleKey: "nav.apiKeys", icon: Key, parent: "/settings" },

  // 其他
  "/code-stats": { label: "代码统计", icon: BarChart3, parent: "/" },
  "/home": { label: "产品首页", icon: Home, parent: "/" },
  "/web": { label: "Web", icon: FileText, parent: "/" },
  "/docs/api/v1": { label: "API 文档", icon: ScrollText, parent: "/" },
  "/docs/mcp/v1": { label: "MCP 文档", icon: Package, parent: "/" },

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
  "/admin/packages/mcp-market": {
    label: "MCP 审核",
    icon: Package,
    parent: "/admin/packages",
  },
  "/admin/packages/skill-market": {
    label: "技能审核",
    icon: Sparkles,
    parent: "/admin/packages",
  },
  "/admin/users": {
    label: "用户管理",
    icon: Sparkles,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/reports": {
    label: "举报管理",
    icon: Flag,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/logs": {
    label: "操作日志",
    icon: ScrollText,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/comments": {
    label: "评论管理",
    icon: MessageSquare,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/collections": {
    label: "合集管理",
    icon: Layers,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/categories": {
    label: "分类管理",
    icon: Grid3X3,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/topics": {
    label: "话题管理",
    icon: MessageSquare,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/rankings": {
    label: "榜单管理",
    icon: TrendingUp,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/operations": {
    label: "运营位管理",
    icon: Layers,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/pages": {
    label: "页面审核",
    icon: FileText,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/moments": {
    label: "动态管理",
    icon: Clock,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/feedbacks": {
    label: "反馈管理",
    icon: Heart,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/notifications": {
    label: "通知管理",
    icon: Bell,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/search-analytics": {
    label: "搜索分析",
    icon: Search,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/activity": {
    label: "活动流",
    icon: Activity,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/api-keys": {
    label: "API 密钥",
    icon: Key,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/analytics": {
    label: "内容分析",
    icon: BarChart3,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/media": {
    label: "媒体管理",
    icon: Image,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/downloads": {
    label: "下载统计",
    icon: Download,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/ratings": {
    label: "评分管理",
    icon: Star,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/drafts": {
    label: "草稿管理",
    icon: FileEdit,
    parent: "/admin",
    dropdownCategory: "管理",
  },
  "/admin/shares": {
    label: "分享管理",
    icon: Link,
    parent: "/admin",
    dropdownCategory: "管理",
  },

  // 阅读面包屑（模式=read 时使用）
  "/read": { label: "页面", icon: FileText, mode: "read" },
}

/** 获取面包屑段，支持传入动态段标签 */
export function resolveBreadcrumbSegments(
  pathname: string,
  dynamicLabels?: Record<string, DynamicSegmentLabel>
): Array<{ href: string; config: RouteConfig; isLast: boolean }> {
  const segments: Array<{ href: string; config: RouteConfig; isLast: boolean }> = []
  const parts = pathname.split("/").filter(Boolean)
  let accumulated = ""

  for (let i = 0; i < parts.length; i++) {
    accumulated += "/" + parts[i]
    const staticConfig = routeRegistry[accumulated]
    const dynamicLabel = dynamicLabels?.[accumulated]
    const isLast = i === parts.length - 1

    if (staticConfig) {
      segments.push({ href: accumulated, config: staticConfig, isLast })
    } else if (dynamicLabel) {
      segments.push({
        href: dynamicLabel.href ?? accumulated,
        config: {
          label: dynamicLabel.label,
          icon: dynamicLabel.icon,
        },
        isLast,
      })
    } else if (!isLast) {
      // 中间段无匹配 — 保留为占位段（用路径段名作为 label）
      segments.push({
        href: accumulated,
        config: { label: parts[i] },
        isLast: false,
      })
    } else {
      // 最末段 — 用路径末段作为 label
      segments.push({
        href: accumulated,
        config: { label: parts[i] },
        isLast: true,
      })
    }
  }

  if (segments.length === 0) {
    segments.push({ href: "/", config: routeRegistry["/"], isLast: true })
  }

  return segments
}

/**
 * 获取同级路由（用于面包屑下拉菜单）
 * parentPath: 父路由路径
 * customSiblings?: 自定义下拉项（用于动态段）
 */
export function getSiblingRoutes(
  parentPath: string,
  customSiblings?: Array<{ href: string; config: RouteConfig }>
): Array<{ href: string; config: RouteConfig }> {
  if (customSiblings) return customSiblings

  // 先查找以 parentPath 为父路由的注册子路由
  const children = Object.entries(routeRegistry).filter(
    ([href, config]) => href !== parentPath && config.parent === parentPath
  )

  // 如果有注册的子路由，优先展示子路由（如 /admin → 管理子页面）
  if (children.length > 0) {
    return children.map(([href, config]) => ({ href, config }))
  }

  const siblings: Array<{ href: string; config: RouteConfig }> = []

  // 对于根路由、/read 段、以及根路由的直接子路由（/category、/leaderboard 等），
  // 且没有注册子路由时，显示社区浏览页下拉（与 index.html 全局下拉一致）
  const parentRoute = routeRegistry[parentPath]
  const isRootChild = parentRoute?.parent === "/"
  if (parentPath === "/" || parentPath === "/read" || isRootChild) {
    for (const [href, config] of Object.entries(routeRegistry)) {
      if (href === parentPath) continue
      if (config.dropdownCategory === "浏览") {
        siblings.push({ href, config })
      }
    }
    return siblings
  }

  for (const [href, config] of Object.entries(routeRegistry)) {
    if (href === parentPath) continue
    if (config.parent === parentPath || (!config.parent && parentPath === "/")) {
      siblings.push({ href, config })
    }
  }

  return siblings
}
