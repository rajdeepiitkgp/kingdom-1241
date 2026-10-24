import { createHmac, timingSafeEqual } from "node:crypto";
import { HOUR } from "@/lib/time";
import { isGovernorId } from "./form";

/**
 * Governor ID verification through MightPulse (parsing and signing are pure
 * and unit-tested; the HTTP call lives in mightpulse.ts).
 *
 * When the lookup succeeds while the player types, the server hands the form a
 * signed token holding what it found. The submission carries the token back,
 * so the final write trusts the lookup without a second API call and a player
 * can't change the verified name on the way.
 */

export interface GovernorProfile {
  governorId: string;
  name: string;
  allianceTag: string | null;
  /** The kingdom number MightPulse reports (`kid`), or null when missing. */
  kingdom: number | null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function int(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(n) ? n : null;
}

/** The `player` block of GET /v1/players/{id} (include=base) → profile; null when the shape is not what we expect. */
export function parseMightPulsePlayer(json: unknown, governorId: string): GovernorProfile | null {
  if (!json || typeof json !== "object") return null;
  const body = json as Record<string, unknown>;
  const player = (body.player && typeof body.player === "object" ? body.player : body) as Record<string, unknown>;
  const name = str(player.nick_name) ?? str(player.nickname) ?? str(player.name);
  if (!name) return null;
  const alliance = player.alliance && typeof player.alliance === "object" ? (player.alliance as Record<string, unknown>) : null;
  const allianceTag = alliance ? (str(alliance.abbr) ?? str(alliance.tag)) : null;
  return {
    governorId,
    name: name.slice(0, 40),
    allianceTag: allianceTag ? allianceTag.toUpperCase().slice(0, 8) : null,
    kingdom: int(player.kid) ?? int(player.kingdom),
  };
}

export const GOVERNOR_TOKEN_MAX_AGE = 2 * HOUR;

function payloadOf(profile: GovernorProfile, scope: string, issuedAt: number): string {
  return Buffer.from(JSON.stringify({ g: profile.governorId, n: profile.name, a: profile.allianceTag, k: profile.kingdom, s: scope, t: issuedAt })).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** `payload.signature`, bound to one retrospective (`scope`) and to the moment it was issued. */
export function signGovernor(profile: GovernorProfile, scope: string, issuedAt: number, secret: string): string {
  const payload = payloadOf(profile, scope, issuedAt);
  return `${payload}.${sign(payload, secret)}`;
}

/** The profile a token vouches for, or null when it is forged, for another retrospective, or older than `maxAge`. */
export function verifyGovernor(token: string | null | undefined, scope: string, now: number, secret: string, maxAge = GOVERNOR_TOKEN_MAX_AGE): GovernorProfile | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (data.s !== scope || typeof data.t !== "number" || now - data.t > maxAge || now < data.t - 60_000) return null;
    if (!isGovernorId(data.g) || typeof data.n !== "string" || !data.n) return null;
    return {
      governorId: data.g,
      name: data.n,
      allianceTag: typeof data.a === "string" && data.a ? data.a : null,
      kingdom: typeof data.k === "number" ? data.k : null,
    };
  } catch {
    return null;
  }
}
