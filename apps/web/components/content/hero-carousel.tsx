"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Eye, ThumbsUp, MessageCircle } from "lucide-react"
import { IconButton } from "@/components/ui/icon-button"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"

export interface HeroSlideData {
  title: string
  subtitle: string
  coverUrl?: string | null
  bg1: string
  bg2: string
  accent: string
  href?: string
  stats?: {
    views: number
    likes: number
    comments: number
  }
}

interface HeroCarouselProps {
  slides: HeroSlideData[]
  autoPlayInterval?: number
  className?: string
}

export function HeroCarousel({ slides, autoPlayInterval = 5200, className }: HeroCarouselProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const restartTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setIndex(prev => (prev + 1) % slides.length)
    }, autoPlayInterval)
  }, [slides.length, autoPlayInterval])

  useEffect(() => {
    restartTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [restartTimer])

  const goTo = (i: number) => {
    setIndex(i)
    restartTimer()
  }

  const prev = () => goTo((index - 1 + slides.length) % slides.length)
  const next = () => goTo((index + 1) % slides.length)

  const slide = slides[index]

  const statsList: StatProps[] = slide.stats
    ? [
        { icon: Eye, value: slide.stats.views, format: true },
        { icon: ThumbsUp, value: slide.stats.likes, format: true },
        { icon: MessageCircle, value: slide.stats.comments, format: true },
      ]
    : []

  return (
    <div className={cn("group relative overflow-hidden rounded-[12px]", className)}>
      {/* Cover */}
      <div
        className="relative aspect-[21/9] min-h-[320px] dark:brightness-75 dark:contrast-125 bg-center bg-cover bg-no-repeat"
        style={{
          backgroundImage: slide.coverUrl
            ? `url(${slide.coverUrl})`
            : `linear-gradient(135deg, ${slide.bg1}, ${slide.bg2})`,
        }}
      >
        {/* Clickable link */}
        {slide.href && (
          <Link href={slide.href} className="absolute inset-0" aria-label={slide.title}>
            <span className="sr-only">{slide.title}</span>
          </Link>
        )}
        {/* Caption */}
        <div className="absolute inset-x-0 bottom-0 p-6 pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
          }}
        >
          <h1 className="text-white font-['Lexend'] text-[clamp(24px,3vw,32px)] leading-[1.08] font-bold mb-2">
            {slide.title}
          </h1>
          <p className="text-white/80 text-[15px] mb-3">{slide.subtitle}</p>
          {statsList.length > 0 && (
            <StatsRow stats={statsList} className="text-white [&_svg]:text-white [&_span]:text-white" />
          )}
        </div>

        {/* Dot Indicators — 底部与 cover 底部对齐 */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 pb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              onMouseEnter={() => goTo(i)}
              className={cn(
                "rounded-full transition-all duration-300",
                i === index
                  ? "size-2.5 ring-2 ring-white/40 ring-offset-1 ring-offset-transparent"
                  : "size-2 bg-white/40 hover:bg-white/60"
              )}
              style={i === index ? { backgroundColor: slide.accent, boxShadow: `0 0 0 3px ${slide.accent}40` } : undefined}
              aria-label={t("community.switchToSlide", { n: i + 1 })}
            />
          ))}
        </div>
      </div>

      {/* Nav Arrows */}
      <IconButton
        label={t("community.previousSlide")}
        size="compact"
        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white border-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={prev}
      >
        <ChevronLeft className="size-5" />
      </IconButton>
      <IconButton
        label={t("community.nextSlide")}
        size="compact"
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white border-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={next}
      >
        <ChevronRight className="size-5" />
      </IconButton>
    </div>
  )
}
