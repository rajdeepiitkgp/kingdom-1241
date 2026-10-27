// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import { ArrowRight, Crown } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";
import { hasSessionMarker } from "@/lib/auth/session-hint";
import { adminPath } from "@/lib/auth/paths";
import { recentRooms } from "@/lib/rally-sync/device";
import { formatRoomCode } from "@/lib/rally-sync/room";
import { useNow } from "../time/useNow";
import { useDevice } from "./hooks";

/** Rooms this device opened today (from localStorage), so a lost link isn't a problem. */
export function RecentRooms({ dict, locale }: { dict: Dictionary; locale: string }) {
  const device = useDevice();
  const now = useNow(60_000);
  const rooms = useMemo(() => (now ? recentRooms(device, now.getTime()) : []), [device, now]);
  if (rooms.length === 0) return null;

  return (
    <section className="card p-5 md:p-6">
      <h2 className="text-lg font-extrabold text-ink">{dict["sync.recent.title"]}</h2>
      <ul className="mt-3 space-y-2">
        {rooms.map((room) => (
          <li key={room.code}>
            <Link href={localePath(locale, `/tools/rally-sync/${room.code}`)} className="card-soft flex items-center gap-3 px-4 py-3 hover:bg-card">
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold wrap-break-word text-ink" dir="auto">
                  {room.title || dict["sync.untitled"]}
                </span>
                <span className="text-sm font-bold text-ink-muted tabular" dir="ltr">
                  {formatRoomCode(room.code)}
                </span>
              </span>
              {room.coordinator && (
                <span className="chip bg-gold-soft text-gold-ink">
                  <Crown className="size-3.5" aria-hidden />
                  {dict["sync.coord.badge"]}
                </span>
              )}
              {room.leader && <span className="chip bg-primary-soft text-primary">{dict["sync.leader.badge"]}</span>}
              <ArrowRight className="size-4 shrink-0 text-ink-faint rtl:rotate-180" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const noSubscribe = () => () => {};

/** For signed-in moderators (marker cookie, a hint only; the admin page checks the role): where rooms are created. */
export function CreateRoomLink({ dict, locale }: { dict: Dictionary; locale: string }) {
  const signedIn = useSyncExternalStore(noSubscribe, () => hasSessionMarker(document.cookie), () => false);
  if (!signedIn) return <p className="text-sm text-ink-muted">{dict["sync.createHint"]}</p>;
  return (
    <Link href={adminPath(locale, "/rally-sync")} className="btn-ghost btn-sm">
      <Crown className="size-4" aria-hidden />
      {dict["sync.create"]}
    </Link>
  );
}
