import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db, mcpPackages, skillPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [mcps, skills] = await Promise.all([
      db.query.mcpPackages.findMany({
        where: eq(mcpPackages.authorId, session.userId),
        orderBy: (pkg, { desc }) => [desc(pkg.createdAt)],
        limit: 10,
      }),
      db.query.skillPackages.findMany({
        where: eq(skillPackages.authorId, session.userId),
        orderBy: (pkg, { desc }) => [desc(pkg.createdAt)],
        limit: 10,
      }),
    ]);

    return NextResponse.json({ mcps, skills });
  } catch (error) {
    console.error('Failed to fetch user packages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch packages' },
      { status: 500 }
    );
  }
}
