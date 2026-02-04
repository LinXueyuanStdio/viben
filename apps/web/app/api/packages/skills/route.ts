import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { uploadPackage } from '@/lib/services/packages';
import { db, skillPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const entityId = formData.get('entityId') as string | null;
    const version = formData.get('version') as string | null;
    const releaseNotes = formData.get('releaseNotes') as string | null;

    if (!file || !entityId || !version) {
      return NextResponse.json(
        { error: 'Missing required fields: file, entityId, version' },
        { status: 400 }
      );
    }

    // Verify ownership
    const pkg = await db.query.skillPackages.findFirst({
      where: eq(skillPackages.id, entityId),
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }

    if (pkg.authorId !== session.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await uploadPackage({
      entityType: 'skill',
      entityId,
      version,
      file: buffer,
      filename: file.name,
      releaseNotes: releaseNotes || undefined,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to upload Skill package:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload package';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
