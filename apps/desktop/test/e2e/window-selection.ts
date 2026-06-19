export function isMainDesktopWindowUrl(url: string): boolean {
  try {
    return new URL(url).pathname.endsWith("/index.html");
  } catch {
    return url.split(/[?#]/, 1)[0].endsWith("/index.html");
  }
}
