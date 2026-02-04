import { z } from 'zod';

export const listReposQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(30),
  sort: z.enum(['created', 'updated', 'pushed', 'full_name']).default('updated'),
});

export const importSkillsSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  skills: z.array(
    z.object({
      path: z.string().min(1),
      name: z.string().min(1).max(100),
      slug: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
      description: z.string().max(500).optional(),
    })
  ).min(1),
});

export type ListReposQuery = z.infer<typeof listReposQuerySchema>;
export type ImportSkillsInput = z.infer<typeof importSkillsSchema>;

// GitHub API response types
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  default_branch: string;
  updated_at: string;
  pushed_at: string;
  language: string | null;
}

export interface GitHubContent {
  type: 'file' | 'dir';
  name: string;
  path: string;
  sha: string;
  size: number;
  download_url: string | null;
  content?: string; // Base64 encoded content
  encoding?: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface DetectedSkill {
  path: string;
  name: string;
  description: string;
  content: string;
}
