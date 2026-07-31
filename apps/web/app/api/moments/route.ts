import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { createMoment, listMoments } from '@/lib/services/community';
import { getSession } from '@/lib/auth/cookies';
import { MomentsListQuery, MomentCreateBody } from '@/lib/validations/moments';

/**
 * 获取动态列表
 * @summary 获取动态列表
 * @description 获取动态列表，支持按 feed_type（following / latest / recommended）过滤和游标分页。following 需要登录，未登录时返回 401。返回 items（动态列表）、nextCursor（分页游标）、hasMore（是否有更多）
 * @params MomentsListQuery
 * @response 200:MomentFeedResponse:动态列表及分页信息
 * @response 401:ErrorResponse:following 模式下未登录
 * @tag Moments
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const feedType = (request.nextUrl.searchParams.get('feed_type') as 'following' | 'latest' | 'recommended') ?? 'latest';
    const rawLimit = Number(request.nextUrl.searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 30) : 10;
    const cursor = request.nextUrl.searchParams.get('cursor');

    const result = await listMoments({ feedType, session, limit, cursor });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: 400 });
  }
}

/**
 * 创建动态
 * @summary 创建新动态
 * @description 创建一条新动态，需登录。支持设置 body（内容）、visibility（可见性：public/unlisted/private，默认 public）、topics（话题标签数组）。成功返回 201，响应体为 { moment: MomentResponse }
 * @body MomentCreateBody
 * @response 201:MomentCreateResponse:创建成功，返回新动态（moment 字段包裹）
 * @response 401:ErrorResponse:未登录
 * @responseSet auth
 * @auth bearer
 * @tag Moments
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const visibility =
      body.visibility === 'unlisted' || body.visibility === 'private'
        ? body.visibility
        : 'public';
    const topics = Array.isArray(body.topics)
      ? body.topics.filter((topic: unknown): topic is string => typeof topic === 'string')
      : [];

    return NextResponse.json({
      moment: await createMoment({
        session,
        body: typeof body.body === 'string' ? body.body : null,
        visibility,
        topics,
      }),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: 400 });
  }
}
