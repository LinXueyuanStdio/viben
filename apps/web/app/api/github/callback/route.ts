import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db, githubConnections } from '@/lib/db';
import { getSession, encryptToken } from '@/lib/auth';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';
import type { GitHubUser } from '@/lib/validations/github';

/**
 * GitHub OAuth 回调 — 仓库访问授权
 * @description 处理 GitHub OAuth 授权回调，用 code 换取 access token，加密存储到数据库。成功后重定向到发布页
 * @params GithubCallbackQuery
 * @responseSet auth
 * @tag GitHub
 * @ignore
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('github_repo_oauth_state')?.value;
  const redirectAfterConnect = cookieStore.get('github_repo_oauth_redirect')?.value || '/assistant';
  cookieStore.delete('github_repo_oauth_state');
  cookieStore.delete('github_repo_oauth_redirect');

  if (!code || !state || state !== storedState) {
    const errorUrl = new URL(redirectAfterConnect, appUrl);
    errorUrl.searchParams.set('github', 'oauth_failed');
    return NextResponse.redirect(errorUrl);
  }

  try {
    // Get current session
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.redirect(`${appUrl}/login?redirect=/publish`);
    }

    // Exchange code for token using the repo OAuth app credentials
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_REPO_CLIENT_ID,
          client_secret: process.env.GITHUB_REPO_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope || 'repo';

    if (!accessToken) {
      console.error('No access token received:', tokenData);
      const errorUrl = new URL(redirectAfterConnect, appUrl);
      errorUrl.searchParams.set('github', 'oauth_failed');
      return NextResponse.redirect(errorUrl);
    }

    // Get GitHub user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubUser: GitHubUser = await userResponse.json();

    // Encrypt the access token before storage
    const encryptedToken = await encryptToken(accessToken);

    // Check if connection already exists
    const existingConnection = await db.query.githubConnections.findFirst({
      where: eq(githubConnections.userId, session.userId),
    });

    if (existingConnection) {
      // Update existing connection
      await db
        .update(githubConnections)
        .set({
          accessTokenEncrypted: encryptedToken,
          scope,
          githubUserId: String(githubUser.id),
          githubUsername: githubUser.login,
          connectedAt: new Date(),
        })
        .where(eq(githubConnections.id, existingConnection.id));
    } else {
      // Create new connection
      await db.insert(githubConnections).values({
        id: generateId(),
        userId: session.userId,
        accessTokenEncrypted: encryptedToken,
        scope,
        githubUserId: String(githubUser.id),
        githubUsername: githubUser.login,
      });
    }

    const successUrl = new URL(redirectAfterConnect, appUrl);
    successUrl.searchParams.set('github', 'connected');
    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    const errorUrl = new URL(redirectAfterConnect, appUrl);
    errorUrl.searchParams.set('github', 'oauth_failed');
    return NextResponse.redirect(errorUrl);
  }
}
