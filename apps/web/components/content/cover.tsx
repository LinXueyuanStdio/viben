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

interface CoverProps {
  src: string
  aspectRatio?: "16/9" | "16/10"
  overlay?: boolean
  children?: ReactNode
  className?: string
}

export function Cover({ src, aspectRatio = "16/9", overlay = false, children, className }: CoverProps) {
  // 将 url(...) 中的完整尺寸 URL 替换为缩略图 URL
  const bg = src.startsWith("url(") ? src.replace(/url\(([^)]+)\)/, (_, url) => `url(${thumbnailUrl(url)})`) : src

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
