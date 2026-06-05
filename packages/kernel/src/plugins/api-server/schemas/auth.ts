import { z } from 'zod';

// Zod schemas for token and code auth API requests.
// Security constraints (max length, regex, expiry cap) are intentional — see inline comments.

// Valid scope strings — prevents arbitrary scope injection and limits payload size.
// Each scope is at most 50 chars; the array is capped at 20 to prevent DoS.
const ScopeItemSchema = z.string().min(1).max(50).regex(/^[a-z*]+(?::[a-z]+)?$/, 'Invalid scope format');
const ScopesSchema = z.array(ScopeItemSchema).max(20).optional();

// Expire duration — capped at 365 days to limit exposure window if a token is stolen.
const MAX_EXPIRE_MS = 365 * 24 * 60 * 60 * 1000;
const ExpireSchema = z.string()
  .regex(/^\d+(h|d|m)$/, 'expire must be a number followed by h, d, or m')
  .refine((v) => {
    const match = v.match(/^(\d+)(h|d|m)$/)!;
    const n = parseInt(match[1]!, 10);
    const unit = match[2]!;
    const ms = unit === 'm' ? n * 60_000 : unit === 'h' ? n * 3_600_000 : n * 86_400_000;
    return ms <= MAX_EXPIRE_MS;
  }, 'Token lifetime cannot exceed 365 days')
  .default('24h');

export const CreateTokenBodySchema = z.object({
  role: z.enum(['admin', 'operator', 'viewer']),
  name: z.string().min(1).max(200),
  expire: ExpireSchema,
  scopes: ScopesSchema,
});

export const RevokeTokenParamSchema = z.object({
  id: z.string().min(1).max(100),
});

// JWT tokens are typically ~300-500 chars; 2 KB is generous but prevents huge payloads
export const RefreshBodySchema = z.object({
  token: z.string().min(1).max(2_000),
});

export const CreateCodeBodySchema = z.object({
  role: z.enum(['admin', 'operator', 'viewer']),
  name: z.string().min(1).max(200),
  expire: ExpireSchema,
  scopes: ScopesSchema,
});

export const ExchangeCodeBodySchema = z.object({
  code: z.string().length(32),
});

export const RevokeCodeParamSchema = z.object({
  code: z.string().length(32),
});
