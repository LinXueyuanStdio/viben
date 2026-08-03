import type { MetadataRoute } from "next";
import { db, publishedPages } from "@/lib/db";
import { eq, desc, and } from "drizzle-orm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: APP_URL, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/web`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/home`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/market`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/mcp-market`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/skill-market`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/leaderboard`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/moment`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/collections`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/docs/mcp/v1`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
  { url: `${APP_URL}/docs/api/v1`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const pages = await db
      .select({
        uid: publishedPages.uid,
        authorSlug: publishedPages.authorSlug,
        lastPublishedAt: publishedPages.lastPublishedAt,
      })
      .from(publishedPages)
      .where(
        and(
          eq(publishedPages.visibility, "public"),
          eq(publishedPages.moderationStatus, "approved"),
        )
      )
      .orderBy(desc(publishedPages.lastPublishedAt));

    const pageEntries: MetadataRoute.Sitemap = pages.map((p) => ({
      url: `${APP_URL}/${encodeURIComponent(p.authorSlug)}/${encodeURIComponent(p.uid)}`,
      lastModified: p.lastPublishedAt ?? new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...STATIC_ROUTES, ...pageEntries];
  } catch {
    return STATIC_ROUTES;
  }
}
