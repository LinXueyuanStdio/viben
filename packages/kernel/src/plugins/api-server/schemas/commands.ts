import { z } from 'zod';

// Zod schemas for the commands API.

export const ExecuteCommandBodySchema = z.object({
  command: z.string().min(1).max(1_000),
  sessionId: z.string().optional(),
});
