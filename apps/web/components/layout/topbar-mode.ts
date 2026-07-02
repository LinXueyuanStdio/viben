export type TopbarMode = "default" | "landing"

export function getTopbarMode(pathname: string): TopbarMode {
  if (pathname.startsWith("/landing")) return "landing"
  return "default"
}
