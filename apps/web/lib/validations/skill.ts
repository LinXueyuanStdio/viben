import { z } from 'zod';

export const listSkillQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.string().optional(),
  type: z.enum(['command', 'prompt', 'agent']).optional(),
  sort: z.enum(['latest', 'popular', 'downloads']).default('latest'),
});

export const searchSkillQuerySchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const createSkillSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().min(1).max(500),
  longDescription: z.string().max(10000).optional(),
  skillType: z.enum(['command', 'prompt', 'agent']).default('command'),
  triggerPatterns: z.array(z.string()).default([]),
  content: z.string().min(1),
  tags: z.array(z.string()).max(10).default([]),
  category: z.string().default('general'),
  compatibility: z.array(z.string()).default([]),
  configSchema: z.record(z.string(), z.unknown()).optional(),
  dependencies: z.array(z.string()).default([]),
});

export const updateSkillSchema = createSkillSchema.partial();

export type ListSkillQuery = z.infer<typeof listSkillQuerySchema>;
export type SearchSkillQuery = z.infer<typeof searchSkillQuerySchema>;
export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
