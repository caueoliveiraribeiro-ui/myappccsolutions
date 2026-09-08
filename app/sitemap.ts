import type { MetadataRoute } from "next"

// Canonical public pages only. The plans HTML iframe canonicalizes to /plans.
// Omit lastModified rather than reporting a false update on every deployment.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://orbit-lm.com/" },
    { url: "https://orbit-lm.com/plans" },
    { url: "https://orbit-lm.com/privacy-policy" },
    { url: "https://orbit-lm.com/terms-of-service" },
  ]
}
