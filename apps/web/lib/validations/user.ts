import { z } from 'zod';
import { isReservedSlug } from '@/lib/utils/user-slug';

export const userSlugRegex = /^[A-Za-z_][A-Za-z0-9_-]{2,29}$/;
export const userSlugMessage =
  'Username must start with a letter or underscore and contain only letters, numbers, underscores, and hyphens';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(userSlugRegex, userSlugMessage)
    .refine((val) => !isReservedSlug(val), {
      message: 'This username is reserved and cannot be used',
    }),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['read', 'write', 'delete'])).default(['read']),
  expiresIn: z.number().min(1).max(365).optional(), // days
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
