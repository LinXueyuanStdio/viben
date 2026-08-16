"use client"

import { useCallback, useEffect, useState } from "react"
import { getCurrentLanguage } from "@/lib/i18n"
import type { PageSessionResponse } from "@/lib/page-chat/types"

export class PageSessionRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "PageSessionRequestError"
    this.status = status
  }
}

export function usePageSession(input: {
  userSlug: string
  pageSlug: string
}): {
  data: PageSessionResponse | undefined
  error: Error | undefined
  isLoading: boolean
  retry: () => Promise<void>
} {
  const [data, setData] = useState<PageSessionResponse>()
  const [error, setError] = useState<Error>()
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      const response = await fetch("/api/page-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_slug: input.userSlug,
          page_slug: input.pageSlug,
          language: getCurrentLanguage(),
        }),
      })

      if (!response.ok) {
        const raw = await response.text()
        let message = raw
        try {
          const parsed = JSON.parse(raw) as { error?: string; code?: string }
          message = parsed.error ?? parsed.code ?? raw
        } catch {
          message = raw
        }
        throw new PageSessionRequestError(
          message || "Page session unavailable",
          response.status,
        )
      }

      const nextData = (await response.json()) as PageSessionResponse
      setData(nextData)
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)))
    } finally {
      setIsLoading(false)
    }
  }, [input.pageSlug, input.userSlug])

  useEffect(() => {
    void load()
  }, [load])

  return {
    data,
    error,
    isLoading,
    retry: load,
  }
}
