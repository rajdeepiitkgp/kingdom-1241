import type { MetadataRoute } from "next";

/** The whole site is private to the kingdom: keep every crawler out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
