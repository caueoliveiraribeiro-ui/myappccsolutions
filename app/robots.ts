import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Crawl guidance only; server-side authentication still protects user data.
      disallow: [
        "/api/", "/dashboard", "/admin/", "/billing", "/subscribe",
        "/forgot-password", "/reset-password", "/set-password",
        "/gmail-test", "/google-connected",
      ],
    },
    sitemap: "https://orbit-lm.com/sitemap.xml",
  }
}
