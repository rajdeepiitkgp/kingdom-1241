import { timingSafeEqual } from "node:crypto";

/**
 * Shared-secret check for the webhook / maintenance routes.
 * Accepts `Authorization: Bearer <secret>` or `x-webhook-secret: <secret>`.
 */
export function isAuthorized(request: Request, secretEnv = "TRANSLATE_WEBHOOK_SECRET"): boolean {
  const expected = process.env[secretEnv]?.trim();
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const provided = bearer || request.headers.get("x-webhook-secret")?.trim() || "";
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
