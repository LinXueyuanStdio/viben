import { NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { status: string; message?: string }> = {
    api: { status: 'ok' },
    env: { status: 'unknown' },
    database: { status: 'unknown' },
  };

  // Check environment variables
  const hasPostgresUrl = !!process.env.POSTGRES_URL;
  checks.env = {
    status: hasPostgresUrl ? 'ok' : 'error',
    message: hasPostgresUrl ? undefined : 'POSTGRES_URL not configured',
  };

  // Check database connection
  if (hasPostgresUrl) {
    try {
      const [result] = await db.select({ count: count() }).from(users);
      checks.database = {
        status: 'ok',
        message: `Connected, ${result?.count ?? 0} users`,
      };
    } catch (error) {
      checks.database = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  } else {
    checks.database = {
      status: 'skipped',
      message: 'Skipped due to missing POSTGRES_URL',
    };
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok');

  return NextResponse.json(
    { status: allOk ? 'healthy' : 'unhealthy', checks },
    { status: allOk ? 200 : 503 }
  );
}
