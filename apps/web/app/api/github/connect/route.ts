import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generateId } from '@/lib/utils';
import { cookies } from 'next/headers';

// GET - Initiate GitHub OAuth for repository access
export async function GET() {
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

    // Store state in cookie for CSRF protection
    const cookieStore = await cookies();
    cookieStore.set('github_repo_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

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
