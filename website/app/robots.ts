import type { MetadataRoute } from "next";
import { site } from "@/lib/site.config";

export const dynamic = "force-static";

// Search engines AND AI crawlers allowed - AI answers are a traffic source, not a threat.
// Landing pages under /lp are NOT disallowed here: they carry a noindex tag instead, and the
// Google Ads bot has to be able to crawl them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/thank-you"] },
      { userAgent: ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"], allow: "/" },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
