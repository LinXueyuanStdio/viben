export type TopbarMode = "default" | "read" | "landing"

export function getTopbarMode(pathname: string): TopbarMode {
  if (pathname.startsWith("/landing")) return "landing"
  if (pathname.startsWith("/read/")) return "read"
  return "default"
}
