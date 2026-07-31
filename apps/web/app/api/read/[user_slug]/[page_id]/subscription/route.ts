import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthError, requireAuth } from '@/lib/auth/middleware';
import {
  getPublishedPageContext,
  subscribeToPage,
  unsubscribeFromPage,
  updatePageSubscription,
} from '@/lib/services/community';

interface RouteContext {
  params: Promise<{ user_slug: string; page_id: string }>;
}

/**
 * 订阅页面
 * @description 订阅指定用户的已发布页面。若已有订阅则更新通知级别；若未订阅则创建新订阅并增加页面的订阅者计数。notify_level 默认为 all，可选 major（仅重大更新）或 none（不通知）。需先通过 canReadPage 权限检查。
 * @pathParams PageSubscriptionParams
 * @body PageSubscribeBody
 * @response 200:SubscriptionSubscribeResponse:订阅结果，含 subscribed、subscriber_count、notify_level、last_seen_version
 * @response 403:ErrorResponse:无权访问页面
 * @response 404:ErrorResponse:页面不存在
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @auth bearer
 * @tag Read
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { user_slug: userSlug, page_id: pageId } = await params;
    const context = await getPublishedPageContext(userSlug, pageId);
    if (!context) return NextResponse.json({ error: 'page_not_found' }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const notifyLevel =
      body.notify_level === 'major' || body.notify_level === 'none' ? body.notify_level : 'all';
    return NextResponse.json(await subscribeToPage({ context, session, notifyLevel }));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: code === 'permission_denied' ? 403 : 400 });
  }
}

/**
 * 取消订阅页面
 * @description 取消对指定用户页面的订阅，若未订阅则静默返回成功。取消后减少页面的订阅者计数（不低于 0）。本端点无权访问检查，任何登录用户均可调用。
 * @pathParams PageSubscriptionParams
 * @response 200:SubscriptionUnsubscribeResponse:取消订阅结果，含 subscribed=false 和当前 subscriber_count
 * @response 404:ErrorResponse:页面不存在
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @auth bearer
 * @tag Read
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { user_slug: userSlug, page_id: pageId } = await params;
    const context = await getPublishedPageContext(userSlug, pageId);
    if (!context) return NextResponse.json({ error: 'page_not_found' }, { status: 404 });
    return NextResponse.json(await unsubscribeFromPage({ context, session }));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

/**
 * 更新订阅设置
 * @description 更新对指定页面的订阅配置。可修改通知级别（all/major/none）和已读版本号（last_seen_version 仅接受非负整数且不低于已有值）。两个字段均为可选，未传则保持原值。未订阅时返回 400。
 * @pathParams PageSubscriptionParams
 * @body PageSubscriptionUpdateBody
 * @response 200:SubscriptionUpdateResponse:更新结果，含 subscribed、notify_level、last_seen_version
 * @response 400:ErrorResponse:未订阅或参数无效
 * @response 403:ErrorResponse:无权访问页面
 * @response 404:ErrorResponse:页面不存在
 * @responseSet auth
 * @response 401:ErrorResponse:未登录
 * @auth bearer
 * @tag Read
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth(request);
    const { user_slug: userSlug, page_id: pageId } = await params;
    const context = await getPublishedPageContext(userSlug, pageId);
    if (!context) return NextResponse.json({ error: 'page_not_found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const notifyLevel =
      body.notify_level === 'all' || body.notify_level === 'major' || body.notify_level === 'none'
        ? body.notify_level
        : undefined;
    const lastSeenVersion =
      Number.isInteger(body.last_seen_version) && body.last_seen_version >= 0
        ? body.last_seen_version
        : undefined;

    return NextResponse.json(
      await updatePageSubscription({
        context,
        session,
        notifyLevel,
        lastSeenVersion,
      })
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = error instanceof Error ? error.message : 'internal_error';
    return NextResponse.json({ error: code }, { status: code === 'permission_denied' ? 403 : 400 });
  }
}
