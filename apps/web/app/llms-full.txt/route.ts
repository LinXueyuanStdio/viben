import { NextResponse } from "next/server";
import { db, publishedPages } from "@/lib/db";
import { eq, desc, and } from "drizzle-orm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50"), 1), 200);

  try {
    const pages = await db
      .select({
        uid: publishedPages.uid,
        title: publishedPages.title,
        html: publishedPages.html,
        description: publishedPages.description,
        tags: publishedPages.tags,
        authorSlug: publishedPages.authorSlug,
        authorDisplayName: publishedPages.authorDisplayName,
        lastPublishedAt: publishedPages.lastPublishedAt,
      })
      .from(publishedPages)
      .where(
        and(
          eq(publishedPages.visibility, "public"),
          eq(publishedPages.moderationStatus, "approved"),
        )
      )
      .orderBy(desc(publishedPages.viewCount))
      .limit(limit);

    const sections = pages.map((p) => {
      const url = `${APP_URL}/${encodeURIComponent(p.authorSlug)}/${encodeURIComponent(p.uid)}`;
      const tags = (p.tags as string[] ?? []).join(", ");
      return [
        "---",
        "",
        `## [${p.title}](${url})`,
        `**作者:** ${p.authorDisplayName ?? p.authorSlug} | **发布时间:** ${p.lastPublishedAt?.toISOString() ?? "未知"} | **标签:** ${tags || "无"}`,
        "",
        p.description ? `> ${p.description}` : "",
        "",
        p.html ?? "",
        "",
      ].join("\n");
    });

    const body = `# Viben Pages\n\n${sections.join("\n")}`;

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate llms-full.txt" },
      { status: 500 },
    );
  }
}
