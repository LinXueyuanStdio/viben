import { NextResponse } from 'next/server';
import { db, users, mcpPackages, skillPackages, publishedPages } from '@/lib/db';
import { count } from 'drizzle-orm';

import { z } from 'zod';

export const HealthCheckResponse = z.object({
  status: z.enum(['healthy', 'unhealthy']).describe('服务整体状态'),
  checks: z.record(z.string(), z.object({
    status: z.enum(['ok', 'error', 'skipped', 'unknown']).describe('检查项状态'),
    message: z.string().optional().describe('检查项详情'),
  })).describe('各项检查结果'),
});

export const dynamic = 'force-dynamic';

/**
 * 健康检查
 * @summary 检查服务健康状态
 * @description 检查 API 服务及各依赖（数据库、核心表）的运行状态，可用于监控和负载均衡探活。全部检查通过返回 200（status=healthy），否则返回 503（status=unhealthy），各检查项独立报告状态（ok/error/skipped）
 * @response 200:HealthCheckResponse:所有检查通过
 * @response 503:HealthCheckResponse:存在失败的检查项
 * @tag Health
 */
export async function GET() {
  const checks: Record<string, { status: string; message?: string }> = {
    api: { status: 'ok' },
    env: { status: 'unknown' },
    database: { status: 'unknown' },
    mcp_table: { status: 'unknown' },
    skill_table: { status: 'unknown' },
    published_pages_table: { status: 'unknown' },
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

    // Check published_pages table
    try {
      const [pagesResult] = await db.select({ count: count() }).from(publishedPages);
      checks.published_pages_table = {
        status: 'ok',
        message: `${pagesResult?.count ?? 0} pages`,
      };
    } catch (error) {
      checks.published_pages_table = {
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
    checks.published_pages_table = {
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
