import { NextResponse } from 'next/server';
import { db, users, oauthConnections } from '@/lib/db';
import { uploadImageFromUrl } from '@/lib/media';
import { setAuthCookies } from '@/lib/auth/cookies';
import { createSession } from '@/lib/auth/session-service';
import { generateId } from '@/lib/utils';
import { normalizeUserSlug } from '@/lib/utils/user-slug';
import { eq, and } from 'drizzle-orm';

/** Google tokeninfo 端点返回的数据 */
interface GoogleTokenInfo {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: string; // "true" / "false"
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  iat: string;
  exp: string;
}

/** @ignore */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { credential } = body;

    if (!credential || typeof credential !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid credential' },
        { status: 400 }
      );
    }

    // 通过 Google tokeninfo 端点验证 ID Token
    const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const tokenInfoRes = await fetch(tokenInfoUrl);

    if (!tokenInfoRes.ok) {
      console.error('[OneTap] Google tokeninfo verification failed:', tokenInfoRes.status);
      return NextResponse.json(
        { error: 'Invalid credential' },
        { status: 400 }
      );
    }

    const tokenInfo: GoogleTokenInfo = await tokenInfoRes.json();

    // 验证 issuer（必须是 Google）
    if (
      tokenInfo.iss !== 'https://accounts.google.com' &&
      tokenInfo.iss !== 'accounts.google.com'
    ) {
      console.error('[OneTap] issuer mismatch:', tokenInfo.iss);
      return NextResponse.json(
        { error: 'Invalid issuer' },
        { status: 400 }
      );
    }

    // 验证 audience（必须匹配当前应用的 client ID，且 client ID 必须已配置）
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('[OneTap] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured');
      return NextResponse.json(
        { error: 'Server misconfigured' },
        { status: 500 }
      );
    }
    if (tokenInfo.aud !== clientId) {
      console.error('[OneTap] audience mismatch:', { aud: tokenInfo.aud, expected: clientId });
      return NextResponse.json(
        { error: 'Invalid audience' },
        { status: 400 }
      );
    }

    // 验证邮箱是否已验证
    if (tokenInfo.email_verified !== 'true') {
      console.error('[OneTap] email not verified');
      return NextResponse.json(
        { error: 'Email not verified' },
        { status: 400 }
      );
    }

    if (!tokenInfo.sub || !tokenInfo.email) {
      console.error('[OneTap] missing sub or email in tokeninfo response');
      return NextResponse.json(
        { error: 'Invalid token response' },
        { status: 400 }
      );
    }

    // ---- 查找或创建用户（复用与 google/callback 相同的三路逻辑） ----

    // 1. 查找已有的 OAuth 连接
    const existingConnection = await db.query.oauthConnections.findFirst({
      where: and(
        eq(oauthConnections.provider, 'google'),
        eq(oauthConnections.providerId, tokenInfo.sub)
      ),
      with: { user: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let user: Record<string, any> | null = null;

    if (existingConnection) {
      // 已有连接：复用用户
      user = existingConnection.user as unknown as Record<string, any>;
    } else {
      // 2. 检查是否有同名邮箱用户
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, tokenInfo.email),
      }) ?? null;

      if (existingUser) {
        // 邮箱已存在：链接 OAuth 连接
        await db.insert(oauthConnections).values({
          id: generateId(),
          userId: existingUser.id,
          provider: 'google',
          providerId: tokenInfo.sub,
          accessToken: null, // One Tap 不返回 access token
        });
        user = existingUser;
      } else {
        // 3. 新用户：创建用户 + OAuth 连接
        const userId = generateId();
        const baseUsername = tokenInfo.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');

        await db.insert(users).values({
          id: userId,
          email: tokenInfo.email,
          username: baseUsername,
          userSlug: normalizeUserSlug(baseUsername, userId),
          displayName: tokenInfo.name || tokenInfo.email,
          avatarUrl: await uploadImageFromUrl({
            imageUrl: tokenInfo.picture,
            kind: 'avatar',
            userSlug: normalizeUserSlug(baseUsername, userId),
            userId,
            uid: userId,
          }) || tokenInfo.picture,
          role: 'developer',
          emailVerified: true,
        });

        await db.insert(oauthConnections).values({
          id: generateId(),
          userId,
          provider: 'google',
          providerId: tokenInfo.sub,
          accessToken: null,
        });

        user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        }) ?? null;
      }
    }

    if (!user) {
      console.error('[OneTap] failed to create or find user');
      return NextResponse.json(
        { error: 'Failed to create or find user' },
        { status: 500 }
      );
    }

    // 签发双 token：access + refresh（refresh 哈希落库）
    const { sessionId, refreshToken } = await createSession(user.id, {
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    });
    await setAuthCookies(
      { userId: user.id, role: (user.role as 'user' | 'developer' | 'admin') || 'developer', sessionId },
      refreshToken,
    );

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error('[OneTap] unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
