import { z } from 'zod';

export const listDraftsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  packageType: z.enum(['mcp', 'skill']).nullish().transform(v => v ?? undefined),
  includeExpired: z.coerce.boolean().default(false),
});

export const createDraftSchema = z.object({
  packageType: z.enum(['mcp', 'skill']),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const updateDraftSchema = z.object({
  data: z.record(z.string(), z.unknown()),
});

// MCP Draft Data schema (for validation when publishing)
export const mcpDraftDataSchema = z.object({
  step: z.number().optional(),
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  version: z.string().default('1.0.0'),
  description: z.string().min(1).max(500),
  longDescription: z.string().max(10000).optional(),
  transport: z.enum(['stdio', 'sse', 'http']).default('stdio'),
  entryPoint: z.string().min(1),
  repositoryUrl: z.string().url().optional().or(z.literal('')),
  homepageUrl: z.string().url().optional().or(z.literal('')),
  license: z.string().default('MIT'),
  tags: z.array(z.string()).max(10).default([]),
  category: z.string().default('general'),
  configSchema: z.record(z.string(), z.unknown()).optional(),
  dependencies: z.array(z.string()).default([]),
});

// Skill Draft Data schema (for validation when publishing)
export const skillDraftDataSchema = z.object({
  step: z.number().optional(),
  importSource: z.enum(['upload', 'directory', 'github']).optional(),
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  version: z.string().default('1.0.0'),
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

export type ListDraftsQuery = z.infer<typeof listDraftsQuerySchema>;
export type CreateDraftInput = z.infer<typeof createDraftSchema>;
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;
export type MCPDraftData = z.infer<typeof mcpDraftDataSchema>;
export type SkillDraftData = z.infer<typeof skillDraftDataSchema>;
