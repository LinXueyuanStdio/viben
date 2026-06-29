"use client"

import { useState, useCallback, useMemo } from "react"
import { SectionHead } from "./section-head"
import { PageCard } from "./page-card"
import type { PageCardData } from "./page-card"

interface RecommendedSectionProps {
  pages: Array<{ data: PageCardData; href: string }>
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function RecommendedSection({ pages }: RecommendedSectionProps) {
  const [shuffledPages, setShuffledPages] = useState(pages)
  const [shuffleKey, setShuffleKey] = useState(0)

  const handleRefresh = useCallback(() => {
    setShuffledPages(shuffleArray(pages))
    setShuffleKey(k => k + 1)
  }, [pages])

  // Keep in sync when the server sends new pages
  const displayPages = useMemo(() => {
    return shuffledPages.slice(0, 6)
  }, [shuffledPages])

  return (
    <section>
      <SectionHead title="推荐">
        <button
          onClick={handleRefresh}
          className="inline-flex items-center text-[14px] font-bold text-primary min-h-[36px] hover:underline"
        >
          换一批
        </button>
      </SectionHead>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {displayPages.map((page, i) => (
          <PageCard key={`${shuffleKey}-${i}`} data={page.data} variant="home" href={page.href} />
        ))}
      </div>
    </section>
  )
}
