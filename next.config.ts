import type { NextConfig } from "next";
import { productionOwnerProblem } from "./src/lib/auth/owner";

// The owner is part of the setup (SETUP.md, step 0): a production build without a valid one fails
// (the live deployment stays as it is); a preview build only warns. CI and local builds aren't checked.
const ownerProblem = productionOwnerProblem(process.env.SITE_OWNER);
if (ownerProblem && process.env.VERCEL_ENV === "production") throw new Error(ownerProblem);
if (ownerProblem && process.env.VERCEL_ENV === "preview") console.warn(`Warning: ${ownerProblem}`);

/** The Supabase project host, for the image optimiser's allow-list (empty when unknown, e.g. CI builds). */
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return null;
  }
})();

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // No form-action: Chrome applies it to the redirect after the Discord sign-in form. HSTS comes from Vercel.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
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
    // Only this project's public Storage bucket may go through the optimiser (hero portraits are served unoptimised).
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : [],
  },
};

export default nextConfig;
