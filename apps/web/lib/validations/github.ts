import { z } from 'zod';

// ============================================
// 请求体 / 查询参数 schemas
// ============================================

export const GithubCallbackQuery = z.object({
  code: z.string().min(1).describe('OAuth 授权码'),
  state: z.string().min(1).describe('CSRF state 参数'),
});

export const GithubReposQuery = z.object({
  page: z.coerce.number().min(1).default(1).describe('页码'),
  perPage: z.coerce.number().min(1).max(100).default(30).describe('每页数量'),
  sort: z.enum(['created', 'updated', 'pushed', 'full_name']).default('updated').describe('排序方式'),
});

/** 桌面端 GitHub OAuth 回调请求体 */
export const GithubDesktopCallbackBody = z.object({
  code: z.string().min(1).describe('GitHub OAuth 授权码'),
});

export const GithubImportBody = z.object({
  owner: z.string().min(1).describe('仓库所有者'),
  repo: z.string().min(1).describe('仓库名'),
  skills: z.array(
    z.object({
      path: z.string().min(1).describe('文件路径'),
      name: z.string().min(1).max(100).describe('Skill 名称'),
      slug: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
        .describe('URL 友好标识符'),
      description: z.string().max(500).optional().describe('描述'),
    })
  ).min(1).describe('要导入的 Skill 列表'),
});

// ============================================
// 类型别名
// ============================================

export type ListReposQuery = z.infer<typeof GithubReposQuery>;
export type ImportSkillsInput = z.infer<typeof GithubImportBody>;

// ============================================
// 响应 schemas
// ============================================

/** 桌面端 GitHub OAuth 回调响应 */
export const GithubDesktopCallbackResponse = z.object({
  user: z.object({
    id: z.string().describe('用户 ID'),
    email: z.string().describe('邮箱'),
    username: z.string().describe('用户名'),
    userSlug: z.string().describe('用户 URL slug'),
    displayName: z.string().nullable().describe('显示名称'),
    avatarUrl: z.string().nullable().describe('头像地址'),
  }).describe('用户信息'),
  accessToken: z.string().describe('JWE 加密的 session token'),
  refreshToken: z.string().nullable().describe('刷新令牌（暂未实现）'),
  expiresAt: z.number().describe('token 过期时间戳（毫秒）'),
});

// ============================================
// GitHub API 响应类型
// ============================================

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
  content?: string;
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
