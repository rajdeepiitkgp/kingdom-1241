import { DAY } from "@/lib/time";
import { DEFAULT_SETTINGS, type RoomSettings } from "./room";
import { clampGameOffset } from "./timing";

/**
 * What this browser remembers for Rally Sync (localStorage, one JSON entry):
 * per room the coordinator token, the leader's own row + token, the invite key
 * and (on the creator's device) the password; the leader's name and march time
 * for the next room; the creator's last room settings; the sound and
 * screen-awake switches; and the game-clock adjustment in seconds. Read with useSyncExternalStore (useDevice); the
 * parsing is pure and tolerant, so a hand-edited value just counts as empty.
 */

export const DEVICE_STORAGE_KEY = "kd1241_rally_sync";
export const DEVICE_CHANGE_EVENT = "kd1241:rally-sync";

export interface DeviceRoom {
  coordinator?: string;
  leader?: { id: string; token: string };
  invite?: string;
  password?: string;
  title?: string;
  /** Last time this device opened the room (ms), for the "your rooms" list. */
  seenAt: number;
}

export interface DeviceData {
  rooms: Record<string, DeviceRoom>;
  profile: { name: string; marchSeconds: number } | null;
  lastSettings: RoomSettings;
  sound: boolean;
  wakeLock: boolean;
  /** How far this device's game clock is from true UTC, in whole seconds (see clampGameOffset). */
  gameOffsetSeconds: number;
}

export const EMPTY_DEVICE: DeviceData = { rooms: {}, profile: null, lastSettings: DEFAULT_SETTINGS, sound: true, wakeLock: true, gameOffsetSeconds: 0 };

const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length < 200;

function parseRoom(value: unknown): DeviceRoom | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const leader = v.leader as Record<string, unknown> | undefined;
  return {
    ...(isString(v.coordinator) ? { coordinator: v.coordinator } : {}),
    ...(leader && isString(leader.id) && isString(leader.token) ? { leader: { id: leader.id, token: leader.token } } : {}),
    ...(isString(v.invite) ? { invite: v.invite } : {}),
    ...(isString(v.password) ? { password: v.password } : {}),
    ...(isString(v.title) ? { title: v.title } : {}),
    seenAt: typeof v.seenAt === "number" ? v.seenAt : 0,
  };
}

/** The stored value (rooms of any age; `updateDevice` forgets those not opened for a day). */
export function parseDevice(raw: string | null | undefined): DeviceData {
  if (!raw) return EMPTY_DEVICE;
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== "object" || value === null) return EMPTY_DEVICE;
    parsed = value as Record<string, unknown>;
  } catch {
    return EMPTY_DEVICE;
  }
  const rooms: Record<string, DeviceRoom> = {};
  if (typeof parsed.rooms === "object" && parsed.rooms !== null) {
    for (const [code, value] of Object.entries(parsed.rooms)) {
      const room = parseRoom(value);
      if (room && /^[A-Z2-9]{6}$/.test(code)) rooms[code] = room;
    }
  }
  const profile = parsed.profile as Record<string, unknown> | undefined;
  const settings = parsed.lastSettings as Partial<RoomSettings> | undefined;
  return {
    rooms,
    profile: profile && isString(profile.name) && typeof profile.marchSeconds === "number" ? { name: profile.name, marchSeconds: profile.marchSeconds } : null,
    lastSettings: settings && typeof settings === "object" ? { ...DEFAULT_SETTINGS, ...pickSettings(settings) } : DEFAULT_SETTINGS,
    sound: parsed.sound !== false,
    wakeLock: parsed.wakeLock !== false,
    gameOffsetSeconds: clampGameOffset(parsed.gameOffsetSeconds),
  };
}

function pickSettings(s: Partial<RoomSettings>): Partial<RoomSettings> {
  const out: Partial<RoomSettings> = {};
  if (s.mode === "rally" || s.mode === "counter") out.mode = s.mode;
  for (const key of ["rallyWaitSeconds", "bufferSeconds", "counterOffsetSeconds"] as const) if (typeof s[key] === "number") out[key] = s[key];
  return out;
}

/** Rooms this device opened within the last day (no room lives longer), most recent first. */
export function recentRooms(data: DeviceData, now: number): Array<{ code: string } & DeviceRoom> {
  return Object.entries(data.rooms)
    .map(([code, room]) => ({ code, ...room }))
    .filter((room) => now - room.seenAt < DAY)
    .sort((a, b) => b.seenAt - a.seenAt);
}

/** The data with rooms older than a day dropped, so the entry doesn't grow. */
export function forgetOldRooms(data: DeviceData, now: number): DeviceData {
  return { ...data, rooms: Object.fromEntries(Object.entries(data.rooms).filter(([, room]) => now - room.seenAt < DAY)) };
}

// ---------------------------------------------------------------------------
// Browser side
// ---------------------------------------------------------------------------

export function readDeviceRaw(): string {
  try {
    return window.localStorage.getItem(DEVICE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function subscribeDevice(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(DEVICE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DEVICE_CHANGE_EVENT, onChange);
  };
}

export function updateDevice(change: (data: DeviceData) => DeviceData): void {
  try {
    window.localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(change(forgetOldRooms(parseDevice(readDeviceRaw()), Date.now()))));
  } catch {
    // Private mode / storage blocked: nothing is remembered, the page still works.
  }
  window.dispatchEvent(new Event(DEVICE_CHANGE_EVENT));
}

/** Merge into one room's entry (and mark it as just opened). */
export function updateDeviceRoom(code: string, change: (room: DeviceRoom) => DeviceRoom): void {
  updateDevice((data) => ({ ...data, rooms: { ...data.rooms, [code]: { ...change(data.rooms[code] ?? { seenAt: 0 }), seenAt: Date.now() } } }));
}

/** The `#k=…&c=…` part of an invite or coordinator link. */
export function parseRoomHash(hash: string): { invite: string | null; coordinator: string | null } {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const clean = (v: string | null) => (v && /^[A-Za-z0-9_-]{10,64}$/.test(v) ? v : null);
  return { invite: clean(params.get("k")), coordinator: clean(params.get("c")) };
}

/** Links a coordinator hands out (relative to the site; the page puts its own origin in front). */
export function inviteLinkPath(code: string, invite: string): string {
  return `/tools/rally-sync/${code}#k=${invite}`;
}

export function coordinatorLinkPath(code: string, invite: string, coordinator: string): string {
  return `/tools/rally-sync/${code}#k=${invite}&c=${coordinator}`;
}
