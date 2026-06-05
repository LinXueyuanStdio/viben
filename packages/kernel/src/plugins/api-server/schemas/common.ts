import { z } from 'zod';

// Shared Zod schemas reused across multiple route groups.

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const IdParamSchema = z.object({
  id: z.string().min(1).max(200),
});

export const NameParamSchema = z.object({
  name: z.string().min(1).max(200),
});

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.unknown().optional(),
  }),
});
