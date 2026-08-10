import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, users, oauthConnections } from '@/lib/db';
import { uploadImageFromUrl } from '@/lib/media';
import { encryptSession } from '@/lib/auth/jwe';
import { generateId } from '@/lib/utils';
import { normalizeUserSlug } from '@/lib/utils/user-slug';
import { upsertGitHubRepoConnection } from '@/lib/github/repo-connection';
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

/** @ignore */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      );
    }

    // Exchange code for GitHub access token
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
    const githubAccessToken = tokenData.access_token;

    if (!githubAccessToken) {
      console.error('No access token received:', tokenData);
      return NextResponse.json(
        { error: 'Failed to get access token from GitHub' },
        { status: 401 }
      );
    }

    // Get GitHub user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${githubAccessToken}` },
    });
    const githubUser: GitHubUser = await userResponse.json();

    // Get GitHub user email
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${githubAccessToken}` },
    });
    const emails: GitHubEmail[] = await emailResponse.json();
    const primaryEmail =
      emails.find((e) => e.primary)?.email || githubUser.email;

    if (!primaryEmail) {
      return NextResponse.json(
        { error: 'No email associated with GitHub account' },
        { status: 400 }
      );
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
        .set({ accessToken: githubAccessToken })
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
          accessToken: githubAccessToken,
        });
        user = existingUser;
      } else {
        // Create new user
        const userId = generateId();
        await db.insert(users).values({
          id: userId,
          email: primaryEmail,
          username: githubUser.login,
          userSlug: normalizeUserSlug(githubUser.login, userId),
          displayName: githubUser.name || githubUser.login,
          avatarUrl: await uploadImageFromUrl({
            imageUrl: githubUser.avatar_url,
            kind: 'avatar',
            userSlug: normalizeUserSlug(githubUser.login, userId),
            userId,
            uid: userId,
          }) || githubUser.avatar_url,
          githubUsername: githubUser.login,
          role: 'developer',
          emailVerified: true,
        });

        await db.insert(oauthConnections).values({
          id: generateId(),
          userId,
          provider: 'github',
          providerId: String(githubUser.id),
          accessToken: githubAccessToken,
        });

        user = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });
      }
    }

    if (!user) {
      throw new Error('Failed to create or find user');
    }

    await upsertGitHubRepoConnection({
      userId: user.id,
      accessToken: githubAccessToken,
      scope: tokenData.scope || 'repo',
      githubUserId: String(githubUser.id),
      githubUsername: githubUser.login,
    });

    // Create JWT access token for desktop client
    const accessToken = await encryptSession({
      userId: user.id,
      username: user.username,
      userSlug: user.userSlug,
      email: user.email,
      role: user.role as 'user' | 'developer' | 'admin',
      avatarUrl: user.avatarUrl ?? undefined,
    });

    // Calculate expiration (7 days from now)
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        userSlug: user.userSlug,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken: null, // TODO: Implement refresh tokens
      expiresAt,
    });
  } catch (error) {
    console.error('Desktop OAuth callback error:', error);
    return NextResponse.json(
      { error: 'OAuth authentication failed' },
      { status: 500 }
    );
  }
}
