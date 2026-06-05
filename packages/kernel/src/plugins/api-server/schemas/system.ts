import { z } from 'zod';

// Zod schemas for system health API responses.

export const HealthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
  memory: z.object({
    rss: z.number(),
    heapTotal: z.number(),
    heapUsed: z.number(),
    external: z.number(),
  }),
});
