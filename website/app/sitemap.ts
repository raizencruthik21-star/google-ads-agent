import type { MetadataRoute } from "next";
import { site } from "@/lib/site.config";

export const dynamic = "force-static";

// The sitemap mirrors the pages that are actually BUILT, nothing more: "" and /about.
// DELIBERATELY EXCLUDED: /thank-you (must never be indexed - it would wreck your
// conversion count), every landing page under /lp (ad pages are noindex and are not
// meant to rank) and the legal pages (no search value).
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/about"];
  return pages.map((path) => ({
    url: `${site.url}${path}`,
    lastModified: new Date(),
    priority: path === "" ? 1 : 0.8,
  }));
}
