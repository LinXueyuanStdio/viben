import { NextRequest, NextResponse } from 'next/server';
import {
  fetchClawhubSkills,
  fetchClawhubSkill,
  searchClawhubSkills,
} from '@/lib/services/clawhub-registry';
import type { ClawhubSkillSortOption } from '@/lib/types/clawhub-registry';

/**
 * GET /api/clawhub-registry
 *
 * Proxy endpoint for fetching from the ClaWHub registry.
 * Supports pagination, sorting, and search.
 *
 * Query params:
 * - cursor: Pagination cursor
 * - search: Search query (uses /search endpoint)
 * - sort: Sort option (updated, downloads, stars, trending, etc.)
 * - limit: Results per page (default: 50, max: 200)
 * - slug: If provided, fetch a specific skill by slug
 * @ignore
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const slug = searchParams.get('slug');

    // Single skill fetch
    if (slug) {
      const skill = await fetchClawhubSkill(slug);

      if (!skill) {
        return NextResponse.json(
          { error: 'Skill not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ skill });
    }

    // Search query
    const search = searchParams.get('search');
    if (search) {
      const limitParam = searchParams.get('limit');
      const limit = limitParam
        ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100)
        : 20;

      const skills = await searchClawhubSkills({
        q: search,
        limit,
        nonSuspiciousOnly: true,
      });

      return NextResponse.json({
        skills,
        nextCursor: null, // Search doesn't support pagination
      });
    }

    // List skills
    const cursor = searchParams.get('cursor') ?? undefined;
    const sortParam = searchParams.get('sort') as ClawhubSkillSortOption | null;
    const sort = sortParam ?? 'updated';
    const limitParam = searchParams.get('limit');
    const limit = limitParam
      ? Math.min(Math.max(1, parseInt(limitParam, 10)), 200)
      : 50;

    const result = await fetchClawhubSkills({
      cursor,
      sort,
      limit,
      nonSuspiciousOnly: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('ClaWHub registry API error:', error);

    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to fetch from ClaWHub registry', details: message },
      { status: 500 }
    );
  }
}
