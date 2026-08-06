import { cookies } from "next/headers";
import { decryptSession } from "@/lib/auth/jwe";

const COOKIE_NAME = "session";

/** 轻量级会话检查 — 直接读取 cookie 解密，不依赖 React cache() */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return Response.json({ user: undefined });
    }

    const session = await decryptSession(token);

    if (!session?.userId) {
      return Response.json({ user: undefined });
    }

    return Response.json({
      user: {
        id: session.userId,
        username: session.username,
        userSlug: session.userSlug,
        email: session.email,
        displayName: session.displayName,
        role: session.role,
        avatarUrl: session.avatarUrl,
      },
    });
  } catch {
    return Response.json({ user: undefined });
  }
}
