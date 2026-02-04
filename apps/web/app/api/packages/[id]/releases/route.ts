import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getReleases, uploadPackage, type Release } from '@/lib/services/packages';
import { db, mcpPackages, skillPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function findPackage(id: string): Promise<{
  entityType: 'mcp' | 'skill';
  authorId: string;
} | null> {
  // Try MCP first
  const mcpPkg = await db.query.mcpPackages.findFirst({
    where: eq(mcpPackages.id, id),
  });
  if (mcpPkg) {
    return { entityType: 'mcp', authorId: mcpPkg.authorId };
  }

  // Try Skills
  const skillPkg = await db.query.skillPackages.findFirst({
    where: eq(skillPackages.id, id),
  });
  if (skillPkg) {
    return { entityType: 'skill', authorId: skillPkg.authorId };
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<{ releases: Release[] } | { error: string }>> {
  try {
    const { id } = await params;

    const pkg = await findPackage(id);
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    const releases = await getReleases(pkg.entityType, id);

    return NextResponse.json({ releases });
  } catch (error) {
    console.error('Failed to get releases:', error);
    return NextResponse.json(
      { error: 'Failed to get releases' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const pkg = await findPackage(id);
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    if (pkg.authorId !== session.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const version = formData.get('version') as string | null;
    const releaseNotes = formData.get('releaseNotes') as string | null;

    if (!file || !version) {
      return NextResponse.json(
        { error: 'Missing required fields: file, version' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadPackage({
      entityType: pkg.entityType,
      entityId: id,
      version,
      file: buffer,
      filename: file.name,
      releaseNotes: releaseNotes || undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to create release:', error);
    const message = error instanceof Error ? error.message : 'Failed to create release';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
