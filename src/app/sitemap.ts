import type { MetadataRoute } from "next";
import { SITE, CALCULATORS } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages = ["", "/about", "/privacy", "/terms"];

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
  ];
}
