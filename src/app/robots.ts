import type { MetadataRoute } from "next";
import { config } from "@/config";

export default function robots(): MetadataRoute.Robots {
  const origin = config.app.origin;
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/invite/", "/offline"],
        disallow: [
          "/api/",
          "/dashboard",
          "/tasks",
          "/taskers",
          "/live",
          "/grievances",
          "/announcements",
          "/my-tasks",
          "/my-grievances",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}