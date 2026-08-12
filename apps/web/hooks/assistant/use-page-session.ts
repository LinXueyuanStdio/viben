"use client"

import { useCallback, useEffect, useState } from "react"
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
        }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new PageSessionRequestError(
          message || "Failed to restore page session",
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
