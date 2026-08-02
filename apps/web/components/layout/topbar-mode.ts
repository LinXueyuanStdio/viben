export type TopbarMode = "default" | "landing"

export function getTopbarMode(pathname: string): TopbarMode {
  if (pathname.startsWith("/home")) return "landing"
  return "default"
}
