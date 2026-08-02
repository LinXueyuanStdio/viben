import { z } from 'zod';
import { isReservedSlug } from '@/lib/utils/user-slug';

export const userSlugRegex = /^[A-Za-z_][A-Za-z0-9_-]{2,29}$/;
export const userSlugMessage =
  'Username must start with a letter or underscore and contain only letters, numbers, underscores, and hyphens';

// ============================================
// 请求体 schemas
// ============================================

export const LoginBody = z.object({
  email: z.string().email('Invalid email address').describe('邮箱地址'),
  password: z.string().min(1).describe('密码'),
});

export const RegisterBody = z.object({
  email: z.string().email('Invalid email address').describe('邮箱地址'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(userSlugRegex, userSlugMessage)
    .refine((val) => !isReservedSlug(val), {
      message: 'This username is reserved and cannot be used',
    })
    .describe('用户名'),
  password: z.string().min(8, 'Password must be at least 8 characters').describe('密码'),
  displayName: z.string().min(1).max(100).describe('显示名称'),
});

export const ForgotPasswordBody = z.object({
  email: z.string().email('Invalid email address').describe('邮箱地址'),
});

export const ResetPasswordBody = z
  .object({
    token: z.string().min(1, 'Token is required').describe('重置令牌'),
    password: z.string().min(8, 'Password must be at least 8 characters').describe('新密码'),
    confirmPassword: z.string().min(1, 'Please confirm your password').describe('确认密码'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const ChangePasswordBody = z.object({
  currentPassword: z.string().optional().describe('当前密码（已有密码的用户需提供，OAuth 用户首次设置密码可为空）'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').describe('新密码'),
});

export const UpdateProfileBody = z.object({
  displayName: z.string().min(1).max(100).optional().describe('显示名称'),
  bio: z.string().max(500).optional().describe('个人简介'),
  websiteUrl: z.string().url().optional().or(z.literal('')).describe('个人网站'),
  avatarUrl: z.string().optional().or(z.literal('')).describe('头像地址'),
});

export const CreateApiKeyBody = z.object({
  name: z.string().min(1).max(100).describe('API Key 名称'),
  scopes: z.array(z.enum(['read', 'write', 'delete'])).default(['read']).describe('权限范围'),
  expiresIn: z.number().min(1).max(365).optional().describe('过期天数，1-365'),
});

/** 关注用户请求体 */
export const FollowUserBody = z.object({
  notify_level: z.enum(['all', 'major', 'none']).optional().describe('通知级别'),
});

/** Google One Tap 登录请求体 */
export const GoogleOneTapBody = z.object({
  credential: z.string().min(1).describe('Google One Tap 返回的 ID Token JWT'),
});

// ============================================
// 前端表单专用 schemas（非 API）
// ============================================

/** 注册表单（含 confirmPassword + agreeToTerms） */
export const RegisterFormSchema = RegisterBody
  .extend({
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    agreeToTerms: z.literal(true, {
      message: 'You must agree to the terms of service',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ============================================
// 响应 schemas
// ============================================

export const UserResponse = z.object({
  user: z.object({
    id: z.string().describe('用户 ID'),
    username: z.string().describe('用户名'),
    userSlug: z.string().describe('用户 URL slug'),
    email: z.string().describe('邮箱'),
    displayName: z.string().nullable().describe('显示名称'),
    bio: z.string().nullable().describe('个人简介'),
    avatarUrl: z.string().nullable().describe('头像地址'),
    websiteUrl: z.string().nullable().describe('个人网站'),
    githubUsername: z.string().nullable().describe('GitHub 用户名'),
    role: z.string().describe('角色'),
    emailVerified: z.boolean().nullable().describe('邮箱是否已验证'),
    createdAt: z.string().nullable().describe('注册时间'),
  }).describe('用户信息'),
});

/** 用户动态数据响应 */
export const UserActivityResponse = z.object({
  data: z.array(z.object({
    date: z.string().describe('日期（YYYY-MM-DD）'),
    count: z.number().describe('当天发布的页面数量'),
  })).describe('每日发布统计'),
});

// ============================================
// 类型别名（下游组件使用）
// ============================================

export type LoginInput = z.infer<typeof LoginBody>;
export type RegisterInput = z.infer<typeof RegisterBody>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordBody>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordBody>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordBody>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileBody>;
export type CreateApiKeyInput = z.infer<typeof CreateApiKeyBody>;
export type RegisterFormInput = z.infer<typeof RegisterFormSchema>;
