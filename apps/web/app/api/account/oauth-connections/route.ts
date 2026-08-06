import { NextResponse } from "next/server";
import { db, oauthConnections } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export interface OAuthConnectionStatus {
  provider: string;
  connected: boolean;
  providerId?: string;
  connectedAt?: string;
}

/** 获取当前用户的 OAuth 连接状态（Google / GitHub 社交登录） */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.query.oauthConnections.findMany({
    where: eq(oauthConnections.userId, session.userId),
    columns: { provider: true, providerId: true, createdAt: true },
  });

  const connectedMap = new Map(rows.map((r) => [r.provider, r]));

  const providers: OAuthConnectionStatus[] = [
    {
      provider: "google",
      connected: connectedMap.has("google"),
      providerId: connectedMap.get("google")?.providerId ?? undefined,
      connectedAt: connectedMap.get("google")?.createdAt?.toISOString() ?? undefined,
    },
    {
      provider: "github",
      connected: connectedMap.has("github"),
      providerId: connectedMap.get("github")?.providerId ?? undefined,
      connectedAt: connectedMap.get("github")?.createdAt?.toISOString() ?? undefined,
    },
  ];

  return NextResponse.json({ providers });
}

const DISCONNECT_SCHEMA = ["google", "github"] as const;

/** 断开指定 OAuth provider */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");
  if (!provider || !DISCONNECT_SCHEMA.includes(provider as typeof DISCONNECT_SCHEMA[number])) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const [deleted] = await db
    .delete(oauthConnections)
    .where(
      and(
        eq(oauthConnections.userId, session.userId),
        eq(oauthConnections.provider, provider as "github" | "google"),
      ),
    )
    .returning({ id: oauthConnections.id });

  if (!deleted) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
