export const USER_SLUG_REGEX = /^[A-Za-z_][A-Za-z0-9_-]{2,29}$/;

/** Reserved words that cannot be used as user slugs */
export const RESERVED_SLUGS = [
  // Next.js app router paths
  'api-docs',
  'analytics',
  'page',
  'pages',
  'read',
  'author',
  'profile',
  'settings',
  'admin',
  'login',
  'register',
  'api',
  'search',
  'tags',
  'tag',
  'category',
  'collections',
  'history',
  'notifications',
  'moment',
  'mcp-market',
  'skill-market',
  'publish',
  'leaderboard',
  'feedback',
  // Profile sub-routes
  'followers',
  'following',
  // Common technical paths
  '_next',
  'favicon',
  'static',
  'public',
  'assets',
  'images',
  'sitemap',
  'robots',
  // Reserved names
  'administrator',
  'root',
  'system',
  'viben',
  'mod',
  'moderator',
  'null',
  'undefined',
  'true',
  'false',
] as const;

/** Check if a slug is a reserved word (case-insensitive) */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase() as typeof RESERVED_SLUGS[number]);
}

export function normalizeUserSlug(input: string, fallbackId: string): string {
  const sanitized = input
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 30);

  const withValidStart = /^[A-Za-z_]/.test(sanitized)
    ? sanitized
    : `_${sanitized}`;

  const padded =
    withValidStart.length >= 3
      ? withValidStart
      : `user_${fallbackId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 8)}`;

  return padded.slice(0, 30);
}

export function assertValidUserSlug(userSlug: string): void {
  if (!USER_SLUG_REGEX.test(userSlug)) {
    throw new Error('Invalid user_slug');
  }
}
