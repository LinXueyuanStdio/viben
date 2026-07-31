import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth/cookies';

/**
 * 执行登出
 * @summary 执行登出
 * @description 清除当前用户的 session cookie 并返回成功状态，适用于 API 调用端（如桌面应用、移动端）的登出操作
 * @response 200:SuccessResponse:登出成功
 * @tag Auth
 */
export async function POST() {
  await clearSession();
  return NextResponse.json({ success: true });
}

/**
 * 获取登出状态
 * @description 清除当前用户的 session cookie 并重定向到首页，适用于浏览器端通过链接访问的登出操作
 * @ignore
 */
export async function GET() {
  await clearSession();
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
