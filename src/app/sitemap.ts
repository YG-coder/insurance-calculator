import type { MetadataRoute } from "next";
import { SITE, CALCULATORS, HUBS } from "@/lib/site";
import { publishedGuides } from "@/lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages = ["", "/about", "/privacy", "/terms", "/disclaimer", "/guide"];

  return [
    ...staticPages.map((p) => ({
      url: `${SITE.url}${p}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1.0 : 0.6,
    })),
    ...CALCULATORS.map((c) => ({
      url: `${SITE.url}${c.href}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...HUBS.map((h) => ({
      url: `${SITE.url}/${h.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...publishedGuides().map((g) => ({
      url: `${SITE.url}/guide/${g.slug}`,
      lastModified: new Date(g.updated),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
