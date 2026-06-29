"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ChevronLeft, ChevronRight, Eye, Heart, MessageCircle } from "lucide-react"
import { IconButton } from "@/components/ui/icon-button"
import { StatsRow } from "./stats-row"
import type { StatProps } from "./stats-row"
import { cn } from "@/lib/utils"

export interface HeroSlideData {
  title: string
  subtitle: string
  image: string
  bg1: string
  bg2: string
  accent: string
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
        { icon: Heart, value: slide.stats.likes, format: true },
        { icon: MessageCircle, value: slide.stats.comments, format: true },
      ]
    : []

  return (
    <div className={cn("relative overflow-hidden rounded-[12px]", className)}>
      {/* Cover */}
      <div
        className="relative aspect-[21/9] min-h-[320px]"
        style={{
          background: `linear-gradient(135deg, ${slide.bg1}, ${slide.bg2}), url(${slide.image}) center/cover`,
        }}
      >
        {/* Caption */}
        <div className="absolute inset-x-0 bottom-0 p-6"
          style={{
            background: `linear-gradient(transparent, ${slide.bg1})`,
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
      </div>

      {/* Progress Track */}
      <div className="flex gap-1.5 px-4 py-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="relative h-1 flex-1 rounded-full bg-surface-secondary overflow-hidden"
            aria-label={`切换到第 ${i + 1} 张`}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300",
                i === index ? "w-[72%]" : "w-0"
              )}
              style={{ backgroundColor: i === index ? slide.accent : "transparent" }}
            />
          </button>
        ))}
      </div>

      {/* Nav Arrows */}
      <IconButton
        label="上一张"
        size="compact"
        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white border-0"
        onClick={prev}
      >
        <ChevronLeft className="size-5" />
      </IconButton>
      <IconButton
        label="下一张"
        size="compact"
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white border-0"
        onClick={next}
      >
        <ChevronRight className="size-5" />
      </IconButton>
    </div>
  )
}
