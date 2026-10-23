import { notFound } from "next/navigation";

/**
 * Catch-all inside the locale layout: any URL that no page matches renders
 * the localized not-found page (with header and navigation) instead of the
 * bare default 404.
 */
export default function CatchAllPage() {
  notFound();
}
