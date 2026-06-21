export const USER_SLUG_REGEX = /^[A-Za-z_][A-Za-z0-9_-]{2,29}$/;

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
