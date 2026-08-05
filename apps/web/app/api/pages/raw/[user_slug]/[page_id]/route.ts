import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPublishedPageContext } from "@/lib/services/community";

export const dynamic = "force-dynamic";

/**
 * 获取公开页面的原始 HTML 内容
 * @summary 获取页面原始内容
 * @description 根据 user_slug 和 page_id 获取已发布公开页面的 HTML 内容。通过 Accept 头可指定返回格式（text/markdown 返回 Markdown，默认返回 HTML）。仅返回 visibility 为 public 的页面。
 * @pathParams PagesRawParams
 * @openapi-override {"responses":{"200":{"description":"返回页面 HTML 内容","content":{"text/html":{"schema":{"type":"string"}}}}}}
 * @response 403:ErrorResponse:页面不可访问
 * @response 404:ErrorResponse:页面不存在
 */
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
