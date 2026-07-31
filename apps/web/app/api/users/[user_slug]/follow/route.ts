import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import { followUser, unfollowUser } from '@/lib/services/community';

interface RouteContext {
  params: Promise<{ user_slug: string }>;
}

/**
 * 关注用户
 * @description 关注指定用户。若已有关注记录则更新通知级别，若未关注则创建新关注并增加目标用户的粉丝计数。notify_level 默认为 all，可选 major（仅重大更新）或 none（不通知）。不能关注自己，尝试关注自己返回 400。
 * @pathParams UserSlugParams
 * @body FollowUserBody
 * @response 200:FollowUserResponse:关注成功，返回 following=true 和当前 followers_count
 * @response 400:ErrorResponse:不能关注自己（cannot_follow_self）
 * @response 404:ErrorResponse:目标用户不存在
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @auth bearer
 * @tag Users
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { user_slug: userSlug } = await params;
    const body = await request.json().catch(() => ({}));
    const notifyLevel =
      body.notify_level === 'major' || body.notify_level === 'none' ? body.notify_level : 'all';

    return NextResponse.json(await followUser({ follower: session, followeeSlug: userSlug, notifyLevel }));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: code === 'cannot_follow_self' ? 400 : 404 });
  }
}

/**
 * 取消关注用户
 * @description 取消对指定用户的关注。若未关注则静默返回成功，粉丝计数不低于 0。本端点无自我关注检查，任何登录用户均可调用。
 * @pathParams UserSlugParams
 * @response 200:UnfollowUserResponse:取关成功，返回 following=false 和当前 followers_count
 * @response 404:ErrorResponse:目标用户不存在
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @auth bearer
 * @tag Users
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { user_slug: userSlug } = await params;
    return NextResponse.json(await unfollowUser({ follower: session, followeeSlug: userSlug }));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }
}
