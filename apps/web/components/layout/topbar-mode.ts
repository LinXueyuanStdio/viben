export type TopbarMode = "default" | "read" | "landing"

export function getTopbarMode(pathname: string, searchParams?: URLSearchParams): TopbarMode {
  if (pathname.startsWith("/landing")) return "landing"
  if (searchParams?.get("tab") === "read") return "read"
  return "default"
}
