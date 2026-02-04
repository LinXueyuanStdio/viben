import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db, githubConnections } from '@/lib/db';
import { getSession, decryptToken } from '@/lib/auth';
import { listReposQuerySchema } from '@/lib/validations/github';
import type { GitHubRepo } from '@/lib/validations/github';
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';

// GET - List user's GitHub repositories
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get GitHub connection
    const connection = await db.query.githubConnections.findFirst({
      where: eq(githubConnections.userId, session.userId),
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'GitHub not connected. Please connect your GitHub account first.' },
        { status: 400 }
      );
    }

    // Decrypt access token
    const accessToken = await decryptToken(connection.accessTokenEncrypted);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to decrypt GitHub access token. Please reconnect your account.' },
        { status: 500 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const query = listReposQuerySchema.parse({
      page: searchParams.get('page'),
      perPage: searchParams.get('perPage'),
      sort: searchParams.get('sort'),
    });

    // Fetch repositories from GitHub
    const params = new URLSearchParams({
      page: String(query.page),
      per_page: String(query.perPage),
      sort: query.sort,
      visibility: 'all', // Include private repos
    });

    const response = await fetch(
      `https://api.github.com/user/repos?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error:', response.status, errorText);

      if (response.status === 401) {
        return NextResponse.json(
          { error: 'GitHub access token expired. Please reconnect your account.' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to fetch repositories from GitHub' },
        { status: response.status }
      );
    }

    const repos: GitHubRepo[] = await response.json();

    // Get pagination info from response headers
    const linkHeader = response.headers.get('link');
    const hasNext = linkHeader?.includes('rel="next"') ?? false;
    const hasPrev = linkHeader?.includes('rel="prev"') ?? false;

    return NextResponse.json({
      repos: repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        description: repo.description,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at,
        language: repo.language,
      })),
      pagination: {
        page: query.page,
        perPage: query.perPage,
        hasNext,
        hasPrev,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }
    console.error('List repos error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
