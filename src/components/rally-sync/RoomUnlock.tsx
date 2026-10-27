// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { type SyncError, unlockRoomWithKey } from "@/lib/rally-sync/actions";
import { parseRoomHash, updateDeviceRoom } from "@/lib/rally-sync/device";
import { JoinRoomForm } from "./JoinRoomForm";

const noSubscribe = () => () => {};

/**
 * A locked room. With an invite link (`#k=…`, maybe `&c=…` for a coordinator)
 * the key is sent once to the server, which sets the room cookie; the
 * fragment is then removed from the address bar so it isn't shared by
 * screenshot. Without one, or when the key no longer works, the password form.
 */
export function RoomUnlock({ code, dict, locale }: { code: string; dict: Dictionary; locale: string }) {
  const router = useRouter();
  const hasKey = useSyncExternalStore(noSubscribe, () => parseRoomHash(window.location.hash).invite !== null, () => false);
  const [failed, setFailed] = useState<SyncError | null>(null);

  useEffect(() => {
    const { invite, coordinator } = parseRoomHash(window.location.hash);
    // A coordinator token counts once the room is open, whichever way it is opened.
    if (coordinator) updateDeviceRoom(code, (room) => ({ ...room, coordinator }));
    if (!invite) return;
    let cancelled = false;
    unlockRoomWithKey(code, invite)
      .then((result) => {
        if (cancelled) return;
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        if (!result.ok) {
          setFailed(result.error);
          return;
        }
        updateDeviceRoom(code, (room) => ({ ...room, invite }));
        router.refresh();
      })
      .catch(() => {
        // Offline or a server error: the password form instead of a spinner that never ends (the link stays in the address bar for a reload).
        if (!cancelled) setFailed("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  if (hasKey && !failed) {
    return (
      <p className="card flex items-center justify-center gap-2 px-5 py-8 font-bold text-ink-muted" role="status">
        <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
        {dict["sync.opening"]}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-3">
      {failed && failed !== "unavailable" && <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm font-bold text-gold-ink">{dict["sync.linkExpired"]}</p>}
      <JoinRoomForm dict={dict} locale={locale} fixedCode={code} />
    </div>
  );
}
