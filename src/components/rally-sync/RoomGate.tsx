// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { ArrowLeft, DoorClosed } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";
import { createLogger } from "@/lib/log";
import { findOpenRoom, roomAccess, roomState } from "@/lib/rally-sync/session";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import { RallyRoom } from "./RallyRoom";
import { RoomUnlock } from "./RoomUnlock";

/**
 * The room page's gate (request time → rendered inside <Suspense>): a closed
 * or unknown room gets a note, a locked one the password form (or the invite
 * link's key), an unlocked one the live room. The room's title is only shown
 * after unlocking.
 */
const log = createLogger("rally-sync");

export async function RoomGate({ code, dict, locale }: { code: string; dict: Dictionary; locale: string }) {
  // Rooms open and close by the minute: always at request time.
  await connection();
  const found = await findOpenRoom(code);
  if ("problem" in found) {
    const key = found.problem === "unavailable" ? "sync.unavailable" : found.problem === "closed" ? "sync.closed.body" : "sync.missing";
    return <ClosedDoor text={dict[key]} back={dict["sync.back"]} locale={locale} />;
  }

  // A database problem after the room was found (a timeout on the instances or leaders) gets the
  // same quiet card as one before it, never the error page: this is the page leaders watch mid-battle.
  let access: Awaited<ReturnType<typeof roomAccess>>;
  let state: Awaited<ReturnType<typeof roomState>> | null = null;
  try {
    access = await roomAccess(found.store, found.room);
    if (access) state = await roomState(found.store, found.room, access.instance);
  } catch (error) {
    log.error("Could not load a room page", { room: found.room.code, error: error instanceof Error ? error.message : String(error) });
    return <ClosedDoor text={dict["sync.unavailable"]} back={dict["sync.back"]} locale={locale} />;
  }
  if (!access || !state) return <RoomUnlock code={found.room.code} dict={dict} locale={locale} />;

  const url = supabaseUrl();
  const key = supabaseAnonKey();
  // The in-memory store (local review) has no Realtime: the page polls instead.
  const realtime = found.store.kind === "supabase" && url && key ? { url, key } : null;
  return <RallyRoom initial={state} realtime={realtime} dict={dict} locale={locale} />;
}

function ClosedDoor({ text, back, locale }: { text: string; back: string; locale: string }) {
  return (
    <div className="card mx-auto max-w-md px-5 py-8 text-center">
      <DoorClosed className="mx-auto size-10 text-ink-faint" aria-hidden />
      <p className="mt-3 font-semibold text-ink-muted">{text}</p>
      <Link href={localePath(locale, "/tools/rally-sync")} className="btn-primary mt-5">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {back}
      </Link>
    </div>
  );
}

export function RoomGateSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-4" aria-hidden>
      <div className="card h-16 bg-card-soft" />
      <div className="card h-48 bg-card-soft" />
      <div className="card h-40 bg-card-soft" />
    </div>
  );
}
