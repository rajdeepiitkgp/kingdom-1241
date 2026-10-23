import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  cacheLife: {
    // Editable site content (announcements, events, rules, guides, ...).
    // Served from cache, refreshed in the background every 5 minutes, and
    // invalidated immediately by the translation webhook / revalidate route.
    content: {
      stale: 60 * 5,
      revalidate: 60 * 5,
      expire: 60 * 60 * 24,
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      // Supabase Storage public buckets (images uploaded by admins).
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
