import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getHomeConfig } from '@/lib/services/community';

/**
 * 获取首页配置
 * @summary 获取首页布局配置
 * @description 返回首页布局配置和内容数据，不同 surface 返回不同结构。当前仅支持 surface=web_home，其他值返回 400。locale 用于多语言适配
 * @params HomeConfigQuery
 * @response 200:HomeConfigResponse:首页配置数据
 * @response 400:ErrorResponse:不支持的 surface 值
 * @tag Home
 */
export async function GET(request: NextRequest) {
  const surface = request.nextUrl.searchParams.get('surface') ?? 'web_home';
  const locale = request.nextUrl.searchParams.get('locale') ?? 'default';

  if (surface !== 'web_home') {
    return NextResponse.json({ error: 'unsupported_surface' }, { status: 400 });
  }

  return NextResponse.json(await getHomeConfig(surface, locale));
}
