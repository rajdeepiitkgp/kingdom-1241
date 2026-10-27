// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { type ReactNode, useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { coordinate, type CoordinatorOp } from "@/lib/rally-sync/actions";
import type { LeaderView } from "@/lib/rally-sync/room";
import { useRunner } from "./hooks";
import { LeaderForm } from "./LeaderForm";

/**
 * A room's list of leaders: the other leaders of a rally room (everyone, for a
 * visitor who isn't leading), or a counter room's launch order. Quiet for
 * leaders; the coordinator opens a row to edit it, sit it out or remove it.
 * `row` draws one leader (with `onEdit` for the coordinator).
 */
export function LeaderList<T extends LeaderView>({
  leaders,
  title,
  empty,
  code,
  coordinatorToken,
  gameOffsetSeconds,
  dict,
  onChanged,
  row,
}: {
  leaders: T[];
  title: ReactNode;
  /** Shown when there is nobody in the list; null shows nothing. */
  empty: string | null;
  code: string;
  coordinatorToken: string | null;
  /** The coordinator's game-clock adjustment, sent with every change like the coordinator panel does. */
  gameOffsetSeconds: number;
  dict: Dictionary;
  onChanged: () => void;
  row: (leader: T, onEdit: (() => void) | undefined) => ReactNode;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const { pending, run, errorFor, fail } = useRunner(onChanged);
  function change(leaderId: string, op: CoordinatorOp) {
    if (!coordinatorToken) return;
    void run(leaderId, () => coordinate(code, coordinatorToken, op, gameOffsetSeconds)).then((done) => {
      if (done) setEditing(null);
    });
  }

  return (
    <section aria-labelledby="sync-leaders-title">
      <h2 id="sync-leaders-title" className="mb-2 px-1 text-xs font-bold tracking-wider text-ink-faint uppercase">
        {title}
      </h2>
      {leaders.length === 0 ? (
        empty && <p className="card-soft px-4 py-3 text-sm font-semibold text-ink-muted">{empty}</p>
      ) : (
        <ul className={clsx("divide-y divide-line overflow-hidden", coordinatorToken ? "card" : "card-soft")}>
          {leaders.map((leader) => (
            <li key={leader.id}>
              {coordinatorToken && editing === leader.id ? (
                <div className="p-4">
                  <LeaderForm
                    dict={dict}
                    idPrefix={`sync-edit-${leader.id}`}
                    defaults={{ name: leader.name, marchSeconds: leader.marchSeconds }}
                    submitLabel={dict["sync.save"]}
                    pending={pending !== null}
                    error={errorFor(leader.id)}
                    onInvalid={() => fail(leader.id, "invalid")}
                    onSubmit={(input) => change(leader.id, { type: "editLeader", leaderId: leader.id, ...input })}
                  >
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(null)}>
                      {dict["sync.cancel"]}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={pending !== null}
                      onClick={() => change(leader.id, { type: "setActive", leaderId: leader.id, active: leader.status === "inactive" })}
                    >
                      {dict[leader.status === "inactive" ? "sync.backIn" : "sync.sitOut"]}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-danger"
                      disabled={pending !== null}
                      onClick={() => change(leader.id, { type: "removeLeader", leaderId: leader.id })}
                    >
                      {dict["sync.remove"]}
                    </button>
                  </LeaderForm>
                </div>
              ) : (
                row(leader, coordinatorToken ? () => setEditing(leader.id) : undefined)
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
