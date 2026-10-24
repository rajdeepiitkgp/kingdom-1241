import { audit } from "@/lib/admin/audit";
import { getRetrospectiveByPlan, listResponses } from "@/lib/admin/retro-data";
import { checkAccess } from "@/lib/auth/server";
import { createLogger, requestId } from "@/lib/log";
import { csvFileName, responsesCsv } from "@/lib/retro/csv";

/**
 * CSV download of a battle's feedback for moderators and admins. No identity
 * columns: the row id is the only identifier (the owner reads names on the
 * page). Under the admin path so the proxy refreshes the session for it.
 */
export async function GET(request: Request, context: RouteContext<"/[locale]/admin/feedback/[planId]/export">) {
  const reqId = requestId(request);
  const log = createLogger("admin").child({ reqId });
  const headers: Record<string, string> = { "x-request-id": reqId, "cache-control": "no-store" };
  const access = await checkAccess("moderator");
  if ("denied" in access) return new Response(access.denied === "signed_out" ? "Sign in first." : "No permission.", { status: access.denied === "signed_out" ? 401 : 403, headers });

  const { planId } = await context.params;
  const retro = await getRetrospectiveByPlan(planId);
  if (!retro) return new Response("Not found.", { status: 404, headers });
  const responses = await listResponses(retro.id, { identity: false });
  const csv = responsesCsv(responses, retro.config);
  await audit(access.user, "retro.export", "kvk_retro_responses", retro.id, { slug: retro.plan.slug, rows: responses.length });
  log.info("Feedback exported", { retro: retro.id, rows: responses.length });
  return new Response(csv, {
    headers: {
      ...headers,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${csvFileName(retro.plan.slug)}"`,
    },
  });
}
