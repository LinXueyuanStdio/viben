"use client"

import * as React from "react"

/**
 * Read server-injected data from a <script type="application/json"> tag.
 * Used for T2/T3 streaming data that arrives after the initial HTML.
 *
 * The data is read once from the DOM on mount (lazy state initializer).
 * Subsequent re-renders use the cached value.
 */
export function useScriptData<T>(scriptId: string): T | null {
  const [data] = React.useState<T | null>(() => {
    if (typeof window === "undefined") return null
    const el = document.getElementById(scriptId)
    if (!el) return null
    try {
      return JSON.parse(el.textContent ?? "") as T
    } catch {
      return null
    }
  })

  return data
}
