// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import { LogOut, UserX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { coordinate, listInstances } from "@/lib/rally-sync/actions";
import { HEARTBEAT_MS, instanceLabel, type InstanceView } from "@/lib/rally-sync/room";
import { useRunner } from "./hooks";
import { ErrorLine } from "./LeaderForm";

/** Last seen within a heartbeat (plus slack): the page is open. */
const ON_SCREEN_MS = HEARTBEAT_MS + 60_000;

/**
 * The coordinator's "In the room" list: every browser that opened the room,
 * shown by its own name, its leaders' names or its random tag, with Remove for
 * each other one and "log everyone else out". Loaded once for the count in its
 * title, then again whenever the room changes (`version`) while the fold is
 * open (`active`), so joins and removals show up on their own without a server
 * call per room change while nobody is looking.
 */
export function InstancesPanel({
  code,
  token,
  version,
  active,
  now,
  dict,
  onCount,
}: {
  code: string;
  token: string;
  /** Changes whenever the room's state was fetched again. */
  version: number | null;
  /** Whether the fold that holds the list is open. */
  active: boolean;
  now: number | null;
  dict: Dictionary;
  onCount: (count: number) => void;
}) {
  const [instances, setInstances] = useState<InstanceView[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [removedNote, setRemovedNote] = useState(false);

  const load = useCallback(() => {
    listInstances(code, token).then(
      (result) => {
        if (!result.ok) return;
        setInstances(result.instances);
        onCount(result.instances.length);
      },
      () => undefined, // offline for a moment: the next room update loads it again
    );
  }, [code, token, onCount]);
  const { pending, run, errorFor } = useRunner(load);

  const loadedOnce = useRef(false);
  useEffect(() => {
    if (!active && loadedOnce.current) return; // folded: the count from the first load is enough
    loadedOnce.current = true;
    load();
  }, [load, version, active]);

  async function remove(instanceId: string) {
    setConfirm(null);
    if (await run("remove", () => coordinate(code, token, { type: "removeInstance", instanceId }))) setRemovedNote(true);
  }

  async function removeOthers() {
    setConfirm(null);
    if (await run("remove", () => coordinate(code, token, { type: "removeOthers" }))) setRemovedNote(true);
  }

  if (instances === null) return <p className="text-sm text-ink-faint">…</p>;
  const others = instances.filter((i) => !i.me);

  return (
    <div>
      <p className="mb-2 text-xs text-ink-muted">{dict["sync.instances.hint"]}</p>
      <ul className="divide-y divide-line">
        {instances.map((instance) => {
          const label = instanceLabel(instance);
          const seenMs = now === null ? null : now - Date.parse(instance.lastSeenAt);
          return (
            <li key={instance.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
              <div className="min-w-0 flex-1 basis-40">
                <p className="font-bold wrap-break-word text-ink" dir="auto">
                  {label.kind === "watcher" ? format(dict["sync.instances.watcher"], { tag: label.text }) : label.text}
                  {instance.me && <span className="chip ms-2 bg-primary align-middle text-primary-ink">{dict["sync.you"]}</span>}
                  {instance.coordinator && <span className="chip ms-2 bg-gold-soft align-middle text-gold-ink">{dict["sync.coord.title"]}</span>}
                </p>
                {seenMs !== null && (
                  <p className="text-xs text-ink-faint">
                    {seenMs < ON_SCREEN_MS ? dict["sync.instances.active"] : format(dict["sync.instances.seen"], { n: Math.round(seenMs / 60_000) })}
                  </p>
                )}
              </div>
              {!instance.me &&
                (confirm === instance.id ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-primary btn-sm bg-danger" onClick={() => void remove(instance.id)} disabled={pending !== null}>
                      <UserX className="size-4" aria-hidden />
                      {dict["sync.instances.removeConfirm"]}
                    </button>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirm(null)}>
                      {dict["sync.cancel"]}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => setConfirm(instance.id)} disabled={pending !== null}>
                    <UserX className="size-4" aria-hidden />
                    {dict["sync.instances.remove"]}
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
      {others.length === 0 && <p className="mt-2 text-sm text-ink-muted">{dict["sync.instances.empty"]}</p>}
      {removedNote && <p className="mt-2 rounded-xl bg-gold-soft px-3 py-2 text-sm font-bold text-gold-ink">{dict["sync.instances.removed"]}</p>}
      {errorFor("remove") && <ErrorLine dict={dict} error={errorFor("remove") ?? "failed"} />}
      {others.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          {confirm === "others" ? (
            <>
              <button type="button" className="btn-primary btn-sm bg-danger" onClick={() => void removeOthers()} disabled={pending !== null}>
                <LogOut className="size-4 rtl:rotate-180" aria-hidden />
                {dict["sync.instances.removeOthersConfirm"]}
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirm(null)}>
                {dict["sync.cancel"]}
              </button>
            </>
          ) : (
            <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => setConfirm("others")} disabled={pending !== null}>
              <LogOut className="size-4 rtl:rotate-180" aria-hidden />
              {dict["sync.instances.removeOthers"]}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
