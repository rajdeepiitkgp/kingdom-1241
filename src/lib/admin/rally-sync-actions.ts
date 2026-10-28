// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use server";

import { revalidatePath } from "next/cache";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess } from "@/lib/auth/server";
import { hashPassword, hashToken, inviteKey, newChannelKey, newRoomCode, newToken } from "@/lib/rally-sync/access";
import { isRoomOpen, parsePassword, parseSettings, parseTitle, type RoomMode } from "@/lib/rally-sync/room";
import { roomCapacity } from "@/lib/rally-sync/session";
import { RallyStoreError, rallyStore } from "@/lib/rally-sync/store";
import { parseDuration } from "@/lib/rally-sync/timing";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { formatGameName } from "./profile";
import { type FieldErrors, localeField, textField, uuidField } from "./forms";

/**
 * Server Actions of the admin Rally Sync page: moderators create rooms (as many
 * of each type open at once as the owner allows; the database enforces it too), destroy them and hand out
 * a new coordinator link. The new room's password, invite key and coordinator
 * token come back once, in the action's reply, for the creator to share; the
 * database keeps hashes only. Every action is audited (room code, never a secret).
 */

export interface CreatedRoom {
  code: string;
  title: string;
  password: string;
  inviteKey: string;
  coordinatorToken: string;
}

export interface CreateRoomState extends ActionState {
  created?: CreatedRoom;
}

export interface ReissueState extends ActionState {
  link?: { code: string; inviteKey: string; coordinatorToken: string };
}

const STORE_MISSING: ActionState = { status: "error", message: "Rally Sync needs the database (migration 0012)." };
const ROOM_GONE: ActionState = { status: "error", message: "That room no longer exists." };
const MODE_NAMES: Record<RoomMode, string> = { rally: "rally", counter: "counter-rally", garrison: "garrison" };

function tooMany(mode: RoomMode, limit: number): ActionState {
  return { status: "error", message: `${limit} ${MODE_NAMES[mode]} ${limit === 1 ? "room is" : "rooms are"} open already. Destroy one below first, or ask the owner for more.` };
}

function editorPath(locale: string): string {
  return adminPath(locale, "/rally-sync");
}

export async function createRallyRoom(_previous: CreateRoomState, formData: FormData): Promise<CreateRoomState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const store = rallyStore();
  if (!store) return STORE_MISSING;

  const errors: FieldErrors = {};
  const title = parseTitle(textField(formData, "title"));
  if (!title.ok) errors.title = "At most 40 characters.";
  const password = parsePassword(textField(formData, "password"));
  if (!password.ok) errors.password = "6 to 64 characters.";
  const rallyWait = parseDuration(textField(formData, "rallyWait"));
  const settings = parseSettings({
    mode: textField(formData, "mode"),
    rallyWaitSeconds: rallyWait ?? NaN,
    bufferSeconds: textField(formData, "buffer"),
  });
  if (!settings.ok) {
    if (rallyWait === null || rallyWait < 10 || rallyWait > 3600) errors.rallyWait = "Minutes:seconds between 0:10 and 60:00, e.g. 5:00.";
    if (!/^\d+$/.test(textField(formData, "buffer")) || Number(textField(formData, "buffer")) > 600) errors.buffer = "0 to 600 seconds.";
  }
  if (!title.ok || !password.ok || !settings.ok) return invalid(errors);

  const user = access.user;
  try {
    const now = Date.now();
    const mode = settings.value.mode;
    const [rooms, capacity] = await Promise.all([store.listRooms(), roomCapacity(store)]);
    const limit = capacity[mode].rooms;
    if (rooms.filter((r) => r.mode === mode && isRoomOpen(r, now)).length >= limit) return tooMany(mode, limit);

    const coordinatorToken = newToken();
    const base = {
      title: title.value,
      passwordHash: await hashPassword(password.value),
      coordinatorHash: hashToken(coordinatorToken),
      channelKey: newChannelKey(),
      ...settings.value,
      createdBy: store.kind === "supabase" ? user.id : null,
      createdByName: formatGameName(user.gameName, user.allianceTag) ?? user.displayName,
    };
    // Six characters from 31 give ~900 million codes; a clash is rare, so a few retries are plenty.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const room = await store.insertRoom({ ...base, code: newRoomCode() });
        if (store.kind === "supabase") await audit(user, "rally_sync.create", "rally_sync_rooms", room.id, { code: room.code, mode: room.mode });
        log.info("Rally room created", { room: room.code });
        revalidatePath(editorPath(localeField(formData)));
        return {
          status: "saved",
          message: `Room ${room.code} is open.`,
          created: { code: room.code, title: room.title, password: password.value, inviteKey: inviteKey(room.id, room.passwordHash), coordinatorToken },
        };
      } catch (error) {
        if (!(error instanceof RallyStoreError && error.problem === "duplicate")) throw error;
      }
    }
    return failed(log, "Creating a rally room", { message: "no free room code after 5 tries" });
  } catch (error) {
    if (error instanceof RallyStoreError && error.problem === "room_limit") {
      const mode = settings.value.mode;
      return tooMany(mode, (await roomCapacity(store))[mode].rooms);
    }
    return failed(log, "Creating a rally room", { message: error instanceof Error ? error.message : String(error) });
  }
}

export async function destroyRallyRoom(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const store = rallyStore();
  if (!store) return STORE_MISSING;
  const id = uuidField(formData, "id");
  if (!id) return ROOM_GONE;
  try {
    const room = await store.roomById(id);
    if (!room) return ROOM_GONE;
    await store.deleteRoom(room.id);
    if (store.kind === "supabase") await audit(access.user, "rally_sync.destroy", "rally_sync_rooms", room.id, { code: room.code });
    log.info("Rally room destroyed", { room: room.code });
    revalidatePath(editorPath(localeField(formData)));
    return { status: "saved", message: `Room ${room.code} destroyed.` };
  } catch (error) {
    return failed(log, "Destroying a rally room", { message: error instanceof Error ? error.message : String(error) });
  }
}

/** A fresh coordinator link; the old one stops working (e.g. the coordinator's phone is gone). */
export async function reissueCoordinatorLink(_previous: ReissueState, formData: FormData): Promise<ReissueState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const store = rallyStore();
  if (!store) return STORE_MISSING;
  const id = uuidField(formData, "id");
  if (!id) return ROOM_GONE;
  try {
    const room = await store.roomById(id);
    if (!room || !isRoomOpen(room, Date.now())) return ROOM_GONE;
    const coordinatorToken = newToken();
    await store.updateRoom(room.id, { coordinatorHash: hashToken(coordinatorToken) });
    if (store.kind === "supabase") await audit(access.user, "rally_sync.coordinator_link", "rally_sync_rooms", room.id, { code: room.code });
    log.info("Rally room coordinator link reissued", { room: room.code });
    return {
      status: "saved",
      message: `New coordinator link for ${room.code}. The old one no longer works.`,
      link: { code: room.code, inviteKey: inviteKey(room.id, room.passwordHash), coordinatorToken },
    };
  } catch (error) {
    return failed(log, "Reissuing a coordinator link", { message: error instanceof Error ? error.message : String(error) });
  }
}
