import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth/cookies';

export async function POST() {
  await clearSession();
  return NextResponse.json({ success: true });
}

export async function GET() {
  await clearSession();
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
