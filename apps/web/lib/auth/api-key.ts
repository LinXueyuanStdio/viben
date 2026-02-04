import { db, apiKeys } from '@/lib/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import type { User } from '@/lib/db/types';

/**
 * Validate an API key and return the associated user
 * API key format: bmcp_XXXXXXXX_YYYYYYYYYYYY
 */
export async function validateApiKey(key: string): Promise<User | null> {
  // API key format: bmcp_XXXXXXXX_YYYYYYYYYYYY
  // Prefix is first 13 chars: bmcp_XXXXXXXX
  const prefix = key.slice(0, 13);

  const apiKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyPrefix, prefix),
    with: { user: true },
  });

  if (!apiKey) return null;

  const valid = await bcrypt.compare(key, apiKey.keyHash);
  if (!valid) return null;

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  // Update last used
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id));

  return apiKey.user;
}

/**
 * Generate a new API key
 * Returns the raw key (only shown once) and the hashed version for storage
 */
export async function generateApiKey(): Promise<{
  key: string;
  keyHash: string;
  keyPrefix: string;
}> {
  // Generate random bytes
  const randomPart1 = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const randomPart2 = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  const key = `bmcp_${randomPart1}_${randomPart2}`;
  const keyPrefix = key.slice(0, 13);
  const keyHash = await bcrypt.hash(key, 12);

  return { key, keyHash, keyPrefix };
}
