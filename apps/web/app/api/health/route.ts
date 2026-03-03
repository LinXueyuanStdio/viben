import { NextResponse } from 'next/server';
import { db, users, mcpPackages, skillPackages } from '@/lib/db';
import { count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { status: string; message?: string }> = {
    api: { status: 'ok' },
    env: { status: 'unknown' },
    database: { status: 'unknown' },
    mcp_table: { status: 'unknown' },
    skill_table: { status: 'unknown' },
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

    // Check mcp_packages table
    try {
      const [mcpResult] = await db.select({ count: count() }).from(mcpPackages);
      checks.mcp_table = {
        status: 'ok',
        message: `${mcpResult?.count ?? 0} packages`,
      };
    } catch (error) {
      checks.mcp_table = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check skill_packages table
    try {
      const [skillResult] = await db.select({ count: count() }).from(skillPackages);
      checks.skill_table = {
        status: 'ok',
        message: `${skillResult?.count ?? 0} skills`,
      };
    } catch (error) {
      checks.skill_table = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  } else {
    checks.database = {
      status: 'skipped',
      message: 'Skipped due to missing POSTGRES_URL',
    };
    checks.mcp_table = {
      status: 'skipped',
      message: 'Skipped due to missing POSTGRES_URL',
    };
    checks.skill_table = {
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
