"use client"

import { useEffect, useState } from "react"

/** 监听 ReadPageClient 设置的 data-page-mode 属性，处理无 ?tab 参数的阅读页 */
export function useReadPageMode(): boolean {
  const [hasPageMode, setHasPageMode] = useState(false)

  useEffect(() => {
    const el = document.documentElement
    const check = () => setHasPageMode(el.getAttribute("data-page-mode") === "read")
    check()
    const observer = new MutationObserver(check)
    observer.observe(el, { attributes: true, attributeFilter: ["data-page-mode"] })
    return () => observer.disconnect()
  }, [])

  return hasPageMode
}
