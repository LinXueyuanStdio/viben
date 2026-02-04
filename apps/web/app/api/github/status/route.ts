import { NextResponse } from 'next/server';
import { db, githubConnections } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { eq } from 'drizzle-orm';

// GET - Check GitHub connection status
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = await db.query.githubConnections.findFirst({
      where: eq(githubConnections.userId, session.userId),
    });

    if (!connection) {
      return NextResponse.json({
        connected: false,
      });
    }

    return NextResponse.json({
      connected: true,
      githubUsername: connection.githubUsername,
      connectedAt: connection.connectedAt,
    });
  } catch (error) {
    console.error('GitHub status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect GitHub
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [deleted] = await db
      .delete(githubConnections)
      .where(eq(githubConnections.userId, session.userId))
      .returning({ id: githubConnections.id });

    if (!deleted) {
      return NextResponse.json(
        { error: 'No GitHub connection found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('GitHub disconnect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
