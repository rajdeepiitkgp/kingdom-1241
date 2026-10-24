import { createLogger } from "@/lib/log";

/**
 * Council alerts: a Discord incoming webhook (ALERT_DISCORD_WEBHOOK_URL). Used
 * for events the council should act on soon, such as a brute-force attempt on
 * the battle-plan password. Optional: without the variable, alerts only reach
 * the admin change log and the server log. Never throws.
 */

const log = createLogger("alerts");

export function alertsConfigured(): boolean {
  return Boolean(process.env.ALERT_DISCORD_WEBHOOK_URL?.trim());
}

export async function notifyCouncil(text: string): Promise<boolean> {
  const url = process.env.ALERT_DISCORD_WEBHOOK_URL?.trim();
  if (!url) return false;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: text.slice(0, 1900), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      log.warn("Discord webhook refused the alert", { status: response.status });
      return false;
    }
    return true;
  } catch (error) {
    log.warn("Could not send the Discord alert", { error });
    return false;
  }
}
