import { z } from 'zod';

export const listMcpQuerySchema = z.object({
  page: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().min(1).default(1)),
  limit: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().min(1).max(100).default(20)),
  category: z.string().nullish().transform(v => v ?? undefined),
  sort: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.enum(['latest', 'popular', 'downloads']).default('latest')),
});

export const searchMcpQuerySchema = z.object({
  q: z.string().min(1),
  page: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().min(1).default(1)),
  limit: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().min(1).max(100).default(20)),
});

export const createMcpSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
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

export const updateMcpSchema = createMcpSchema.partial();

export type ListMcpQuery = z.infer<typeof listMcpQuerySchema>;
export type SearchMcpQuery = z.infer<typeof searchMcpQuerySchema>;
export type CreateMcpInput = z.infer<typeof createMcpSchema>;
export type UpdateMcpInput = z.infer<typeof updateMcpSchema>;
