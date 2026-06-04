export function getPublicAssetUrl(path: string, baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path

  return `${normalizedBase}${normalizedPath}`
}
