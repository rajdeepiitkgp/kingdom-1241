// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { ArrowLeft, DoorClosed } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";
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
export async function RoomGate({ code, dict, locale }: { code: string; dict: Dictionary; locale: string }) {
  // Rooms open and close by the minute: always at request time.
  await connection();
  const found = await findOpenRoom(code);
  if ("problem" in found) {
    const key = found.problem === "unavailable" ? "sync.unavailable" : found.problem === "closed" ? "sync.closed.body" : "sync.missing";
    return (
      <div className="card mx-auto max-w-md px-5 py-8 text-center">
        <DoorClosed className="mx-auto size-10 text-ink-faint" aria-hidden />
        <p className="mt-3 font-semibold text-ink-muted">{dict[key]}</p>
        <Link href={localePath(locale, "/tools/rally-sync")} className="btn-primary mt-5">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {dict["sync.back"]}
        </Link>
      </div>
    );
  }

  const access = await roomAccess(found.store, found.room);
  if (!access) return <RoomUnlock code={found.room.code} dict={dict} locale={locale} />;

  const state = await roomState(found.store, found.room, access.instance);
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  // The in-memory store (local review) has no Realtime: the page polls instead.
  const realtime = found.store.kind === "supabase" && url && key ? { url, key } : null;
  return <RallyRoom initial={state} realtime={realtime} dict={dict} locale={locale} />;
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
