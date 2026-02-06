import { NextRequest, NextResponse } from 'next/server';
import {
  fetchOfficialServers,
  fetchOfficialServer,
} from '@/lib/services/official-registry';

/**
 * GET /api/official-registry
 *
 * Proxy endpoint for fetching from the official MCP registry.
 * Supports pagination and search.
 *
 * Query params:
 * - cursor: Pagination cursor
 * - search: Search query
 * - limit: Results per page (default: 50, max: 100)
 * - name: If provided, fetch a specific server by name
 * - version: Version to fetch (only with name)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');

    // Single server fetch
    if (name) {
      const version = searchParams.get('version') ?? undefined;
      const server = await fetchOfficialServer(name, version);

      if (!server) {
        return NextResponse.json(
          { error: 'Server not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ server });
    }

    // List servers
    const cursor = searchParams.get('cursor') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam
      ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100)
      : 50;

    const result = await fetchOfficialServers({ cursor, search, limit });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Official registry API error:', error);

    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      { error: 'Failed to fetch from official registry', details: message },
      { status: 500 }
    );
  }
}
