import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: [
          "GPTBot",
          "ClaudeBot",
          "Claude-SearchBot",
          "PerplexityBot",
          "Google-Extended",
          "CCBot",
        ],
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: ["Googlebot", "Bingbot"],
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
      {
        userAgent: "*",
        disallow: ["/admin/", "/api/"],
        allow: "/",
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
