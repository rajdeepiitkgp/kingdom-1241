import { checkAccess, type CurrentUser } from "@/lib/auth/server";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatGameName } from "./profile";

/** Who changed what in the admin area (table `audit_log`). Server only. */

const log = createLogger("admin");

export async function audit(
  actor: CurrentUser,
  action: string,
  table: string | null,
  rowId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_id: actor.id,
    actor_name: formatGameName(actor.gameName, actor.allianceTag) ?? actor.displayName,
    action,
    table_name: table,
    row_id: rowId,
    details,
  });
  if (error) log.error("Could not write the audit entry", { action, error: error.message });
  log.info("Admin action", { action, table, rowId, actor: actor.id });
}

export interface AuditEntry {
  id: number;
  actorName: string;
  action: string;
  table: string | null;
  rowId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export async function recentAudit(limit = 15): Promise<AuditEntry[]> {
  const access = await checkAccess("moderator");
  if ("denied" in access) {
    log.warn("Audit log requested without access", { reason: access.denied });
    return [];
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("audit_log")
    .select("id, actor_name, action, table_name, row_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    log.error("Could not read the audit log", { error: error.message });
    return [];
  }
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    actorName: String(row.actor_name ?? ""),
    action: String(row.action ?? ""),
    table: typeof row.table_name === "string" ? row.table_name : null,
    rowId: typeof row.row_id === "string" ? row.row_id : null,
    details: (row.details ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at ?? ""),
  }));
}
