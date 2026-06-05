import { z } from 'zod';

// Zod schemas for agent catalog API responses.

export const AgentResponseSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  workingDirectory: z.string().optional(),
});
