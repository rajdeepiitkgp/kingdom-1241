/** "25 Oct 2026, 14:00" in UTC, for admin lists (server-rendered, so never the visitor's zone). */
export function utcLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }).format(ms);
}
