export type TopbarMode = "default" | "read" | "landing"

const READ_MODE_TABS = new Set(["read", "settings"])

export function getTopbarMode(pathname: string, searchParams?: URLSearchParams): TopbarMode {
  if (pathname.startsWith("/landing")) return "landing"
  const tab = searchParams?.get("tab")
  if (tab && READ_MODE_TABS.has(tab)) return "read"
  return "default"
}
