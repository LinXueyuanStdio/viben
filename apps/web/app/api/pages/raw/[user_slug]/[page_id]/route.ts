import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPublishedPageContext } from "@/lib/services/community";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user_slug: string; page_id: string }> },
) {
  const { user_slug, page_id } = await params;

  const ctx = await getPublishedPageContext(user_slug, page_id);
  if (!ctx) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  // Can only serve public pages via this endpoint
  if (ctx.page.visibility !== "public") {
    return NextResponse.json({ error: "Page not accessible" }, { status: 403 });
  }

  const accept = request.headers.get("accept") ?? "";

  if (accept.includes("text/markdown")) {
    return new NextResponse(ctx.page.html ?? "", {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Vary": "Accept",
      },
    });
  }

  // Default: return HTML content as structured text
  return new NextResponse(ctx.page.html ?? "", {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Vary": "Accept",
    },
  });
}
