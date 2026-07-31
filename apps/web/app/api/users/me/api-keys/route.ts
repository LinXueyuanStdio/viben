import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, apiKeys } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/auth/middleware';
import { CreateApiKeyBody } from '@/lib/validations/user';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { ZodError } from 'zod';

/**
 * 列出当前用户的 API Keys
 * @description 返回当前用户的所有 API Key 元信息（不含完整密钥，完整密钥仅在创建时返回一次）。返回字段包括 id、name、keyPrefix、scopes、expiresAt、lastUsedAt、createdAt，按创建时间降序排列。需登录后调用。
 * @response 200:ApiKeysListResponse:API Key 元信息列表
 * @response 500:ErrorResponse:服务器内部错误
 * @responseSet auth
 * @response 401:ErrorResponse:未登录或 token 无效
 * @auth bearer
 * @tag ApiKeys
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, session.userId),
      columns: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: (apiKeys, { desc }) => [desc(apiKeys.createdAt)],
    });

    return NextResponse.json({ keys });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('List API keys error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 创建 API Key
 * @description 生成一个新的 API Key（格式 bmcp_XXXXXXXX_YYYYYYYYYYYYYYYYYYYYYYYY）。完整密钥仅在创建时返回一次，之后无法再次获取。scopes 默认为 ['read']，expiresIn 为可选过期天数（1-365）。密钥哈希使用 bcrypt(12) 存储。需登录后调用。
 * @body CreateApiKeyBody
 * @response 201:ApiKeyCreateResponse:API Key 创建成功，返回完整密钥（仅此一次）、apiKey 元信息和安全提示
 * @response 400:ErrorResponse:请求体验证失败
 * @response 500:ErrorResponse:服务器内部错误
 * @responseSet auth
 * @response 401:ErrorResponse:未登录或 token 无效
 * @auth bearer
 * @tag ApiKeys
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { name, scopes, expiresIn } = CreateApiKeyBody.parse(body);

    // Generate key: bmcp_XXXXXXXX_YYYYYYYYYYYYYYYYYYYYYYYY
    const prefix = `bmcp_${generateId().slice(0, 8)}`;
    const secret = generateId().replace(/-/g, '') + generateId().replace(/-/g, '');
    const fullKey = `${prefix}_${secret.slice(0, 24)}`;

    const keyHash = await bcrypt.hash(fullKey, 12);

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
      : null;

    const keyId = generateId();
    const createdAt = new Date();
    await db.insert(apiKeys).values({
      id: keyId,
      userId: session.userId,
      name,
      keyHash,
      keyPrefix: prefix,
      scopes,
      expiresAt,
      createdAt,
    });

    // Return the full key only once, along with apiKey object for list update
    return NextResponse.json({
      key: fullKey,
      apiKey: {
        id: keyId,
        name,
        keyPrefix: prefix,
        scopes,
        expiresAt,
        lastUsedAt: null,
        createdAt: createdAt.toISOString(),
      },
      warning: 'Save this key now. You will not be able to see it again.',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Create API key error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
