import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db, users, oauthConnections } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils';
import { eq, and } from 'drizzle-orm';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;
  cookieStore.delete('oauth_state');

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_state`);
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('No access token received:', tokenData);
      return NextResponse.redirect(`${appUrl}/login?error=no_token`);
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubUser: GitHubUser = await userResponse.json();

    // Get email
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const emails: GitHubEmail[] = await emailResponse.json();
    const primaryEmail =
      emails.find((e) => e.primary)?.email || githubUser.email;

    if (!primaryEmail) {
      return NextResponse.redirect(`${appUrl}/login?error=no_email`);
    }

    // Find existing OAuth connection
    const existingConnection = await db.query.oauthConnections.findFirst({
      where: and(
        eq(oauthConnections.provider, 'github'),
        eq(oauthConnections.providerId, String(githubUser.id))
      ),
      with: { user: true },
    });

    let user;

    if (existingConnection) {
      // Update access token
      await db
        .update(oauthConnections)
        .set({ accessToken })
        .where(eq(oauthConnections.id, existingConnection.id));

      user = existingConnection.user;
    } else {
      // Check if user with this email exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, primaryEmail),
      });

      if (existingUser) {
        // Link OAuth to existing user
        await db.insert(oauthConnections).values({
          id: generateId(),
          userId: existingUser.id,
          provider: 'github',
          providerId: String(githubUser.id),
          accessToken,
        });
        user = existingUser;
      } else {
        // Create new user
        const userId = generateId();
        await db.insert(users).values({
          id: userId,
          email: primaryEmail,
          username: githubUser.login,
          displayName: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
          githubUsername: githubUser.login,
          role: 'user',
          emailVerified: true,
        });

        await db.insert(oauthConnections).values({
          id: generateId(),
          userId,
          provider: 'github',
          providerId: String(githubUser.id),
          accessToken,
        });

        user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });
      }
    }

    if (!user) {
      throw new Error('Failed to create or find user');
    }

    // Set session
    await setSessionCookie({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role as 'user' | 'developer' | 'admin',
      avatarUrl: user.avatarUrl ?? undefined,
    });

    return NextResponse.redirect(`${appUrl}/mcp`);
  } catch (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(`${appUrl}/login?error=oauth_failed`);
  }
}
