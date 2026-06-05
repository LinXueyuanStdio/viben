import { z } from 'zod';

// Zod schemas for config API requests.

export const UpdateConfigBodySchema = z.object({
  path: z.string().min(1),
  value: z.unknown(),
});
