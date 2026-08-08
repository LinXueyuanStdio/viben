import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateId } from '@/lib/utils';
import { cookies } from 'next/headers';

/**
 * 发起 GitHub 连接授权
 * @description 生成 OAuth state 并重定向到 GitHub 授权页面，请求 repo 权限以访问仓库
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @tag GitHub
 * @ignore
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the separate GitHub OAuth app for repo access
    const clientId = process.env.GITHUB_REPO_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!clientId) {
      return NextResponse.json(
        { error: 'GitHub OAuth for repository access is not configured' },
        { status: 500 }
      );
    }

    const state = generateId();

    // Read redirect param for post-auth redirect
    const redirectParam = request.nextUrl.searchParams.get('redirect');

    const cookieStore = await cookies();
    // Store state in cookie for CSRF protection
    cookieStore.set('github_repo_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    // Store redirect destination for callback
    if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
      cookieStore.set('github_repo_oauth_redirect', redirectParam, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
      });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${appUrl}/api/github/callback`,
      scope: 'repo', // Full repo access for reading private repos
      state,
    });

    return NextResponse.redirect(
      `https://github.com/login/oauth/authorize?${params}`
    );
  } catch (error) {
    console.error('GitHub connect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
