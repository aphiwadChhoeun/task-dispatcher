import type { MetadataRoute } from "next";
import { config } from "@/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = config.app.origin;
  const now = new Date();
  return [
    {
      url: `${origin}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${origin}/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/offline`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}