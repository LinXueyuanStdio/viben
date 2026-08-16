import { createHash, randomBytes } from 'node:crypto';

const REFRESH_TOKEN_BYTES = 32;

/**
 * 生成 32 字节不透明 refresh token（base64url，43 字符）。
 * 注意：本模块使用 node:crypto，只能在 Node runtime（API route / server action）导入，
 * 不要在 Edge runtime（middleware）里 import，否则会因 node: 内置模块不可用而编译失败。
 */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

/** refresh token 的 SHA-256 十六进制哈希（DB 只存哈希，不落明文）。 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
