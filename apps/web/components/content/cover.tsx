import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * 将封面完整尺寸 URL 转为缩略图 URL（插入 _thumb 后缀）。
 * 仅处理 Viben 媒体代理 URL，外部 URL 原样返回。
 */
export function thumbnailUrl(url: string): string {
  if (url.includes("/api/media/asset?pathname=")) {
    return url.replace(/\.(\w+)([?&]|$)/, "_thumb.$1$2")
  }
  return url
}

/**
 * 基于标题生成稳定的渐变色封面。
 * 色调由标题首字符决定，同一标题始终生成相同渐变。
 */
export function gradientCover(title: string): string {
  const hue = title.charCodeAt(0) % 360
  return `linear-gradient(135deg, hsl(${hue},60%,35%), hsl(${(hue + 30) % 360},50%,45%))`
}

interface CoverProps {
  coverUrl?: string | null
  fallbackTitle?: string
  aspectRatio?: "16/9" | "16/10"
  overlay?: boolean
  children?: ReactNode
  className?: string
}

export function Cover({
  coverUrl,
  fallbackTitle,
  aspectRatio = "16/9",
  overlay = false,
  children,
  className,
}: CoverProps) {
  const bg: string = coverUrl
    ? `url(${thumbnailUrl(coverUrl)})`
    : gradientCover(fallbackTitle ?? "")

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[9px] dark:brightness-75 dark:contrast-125 bg-cover bg-center bg-no-repeat",
        aspectRatio === "16/9" ? "aspect-video" : "aspect-[16/10]",
        className
      )}
      style={bg.startsWith("url(") ? { backgroundImage: bg } : { background: bg }}
    >
      {overlay && (
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      )}
      {children && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 p-2">
          {children}
        </div>
      )}
    </div>
  )
}
