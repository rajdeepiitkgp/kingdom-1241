"use client";

import clsx from "clsx";
import { useActionState, useState } from "react";
import { type ActionState, IDLE_STATE } from "@/lib/admin/action-state";
import { utcLabel } from "@/lib/admin/format";
import { toUtcInputValue } from "@/lib/admin/forms";
import { addGiftCode, checkGiftCodesNow, deleteGiftCode, saveGiftCode, setGiftCodeShown } from "@/lib/admin/gift-codes-actions";
import type { AdminGiftCode, GiftCodesAdmin as Data } from "@/lib/admin/gift-codes-data";
import { CODE_HINT, MAX_REWARDS } from "@/lib/gift-codes/forms";
import { KINGSHOT_SITE } from "@/lib/gift-codes/kingshot";
import { type GiftCodeState, HOURLY_CHECK_MINUTE } from "@/lib/gift-codes/sync-plan";
import { useSubmitInTransition } from "@/components/ui/useSubmitInTransition";
import { DateTimeField } from "./DateTimeField";
import { AdminSection, EmptyRow, Field, Notice } from "./ui";

/** The gift codes on Home: kingshot.net's list, checked every hour, plus the ones moderators add. */

const STATE_CHIPS: Record<GiftCodeState, [string, string]> = {
  home: ["On Home", "bg-success-soft text-success"],
  hidden: ["Hidden", "bg-card-soft text-ink-muted"],
  ended: ["Ended", "bg-gold-soft text-gold-ink"],
  expired: ["Expired", "bg-card-soft text-ink-muted"],
};

/** Guide markers of the add form only (an open edit form would otherwise be the first drawn). */
const ADD_FORM = { rewardsTour: "gift-codes-rewards", expiryTour: "gift-codes-expiry" };

export function GiftCodesAdmin({ data, locale }: { data: Data; locale: string }) {
  if (!data.migrated) {
    return <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">The database doesn&apos;t have the gift-code columns yet (migration 0018). Reload once the deploy has finished.</p>;
  }
  if (!data.available) return <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">The gift codes could not be read from the database.</p>;
  const current = data.codes.filter((code) => code.state === "home" || code.state === "hidden");
  const old = data.codes.filter((code) => code.state === "ended" || code.state === "expired");
  return (
    <div className="space-y-6">
      <CheckStatus data={data} locale={locale} />
      <AdminSection title="Codes" hint="Newest first. Hidden codes stay off Home until you show them again." tour="gift-codes-list">
        {current.length === 0 ? (
          <EmptyRow>No working codes right now. New ones appear here within the hour of kingshot.net listing them.</EmptyRow>
        ) : (
          <ul className="divide-y divide-line">
            {current.map((code) => (
              <CodeRow key={code.id} code={code} locale={locale} />
            ))}
          </ul>
        )}
      </AdminSection>
      <AdminSection title="Add a code" hint="For a code from in-game mail or Discord that isn't on the list yet." tour="gift-codes-add">
        <CodeForm locale={locale} />
      </AdminSection>
      {old.length > 0 && (
        <details className="card p-5" data-tour="gift-codes-old">
          <summary className="cursor-pointer text-lg font-extrabold text-ink">Ended and expired ({old.length})</summary>
          <p className="mt-1 text-sm text-ink-muted">No longer on Home. They are deleted 30 days after they ended or expired.</p>
          <ul className="mt-2 divide-y divide-line">
            {old.map((code) => (
              <CodeRow key={code.id} code={code} locale={locale} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CheckStatus({ data, locale }: { data: Data; locale: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(checkGiftCodesNow, IDLE_STATE);
  const { sync } = data;
  const [text, tone] = !sync.at
    ? [`Not checked yet. ${KINGSHOT_SITE} is checked every hour at minute ${HOURLY_CHECK_MINUTE}; Check now does it at once.`, "text-ink-muted"]
    : sync.ok
      ? [
          `Last check ${utcLabel(sync.at)} UTC (${sync.by === "now" ? "Check now" : "hourly"}): ${KINGSHOT_SITE} lists ${sync.listed} working ${sync.listed === 1 ? "code" : "codes"}.`,
          "text-success",
        ]
      : [
          `Last check ${utcLabel(sync.at)} UTC: ${KINGSHOT_SITE} didn't answer${sync.okAt ? ` (last good check ${utcLabel(sync.okAt)} UTC)` : ""}. The codes stay as they are; add a new one by hand if needed.`,
          "text-danger",
        ];
  return (
    <form action={action} className="card space-y-3 p-5" data-tour="gift-codes-check">
      <input type="hidden" name="locale" value={locale} />
      <p className={clsx("text-sm font-bold", tone)}>{text}</p>
      <button type="submit" className="btn-primary btn-sm" disabled={pending}>
        {pending ? "Checking…" : `Check ${KINGSHOT_SITE} now`}
      </button>
      <Notice state={state} />
    </form>
  );
}

function CodeRow({ code, locale }: { code: AdminGiftCode; locale: string }) {
  const [editing, setEditing] = useState(false);
  const [showState, showAction, showing] = useActionState<ActionState, FormData>(setGiftCodeShown, IDLE_STATE);
  const [deleteState, deleteAction, deleting] = useActionState<ActionState, FormData>(deleteGiftCode, IDLE_STATE);
  const [label, chip] = STATE_CHIPS[code.state];
  // kingshot.net still lists it: deleted, it would be back within the hour.
  const deletable = code.source === "manual" || code.endedAt !== null;
  const canHide = code.state === "home" || code.state === "hidden";
  return (
    <li className="space-y-2 py-4">
      <div className={clsx("min-w-0 space-y-1", code.state !== "home" && "opacity-75")}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <code className="rounded-lg bg-gold-soft px-2.5 py-1 text-sm font-black tracking-wider break-all text-gold-ink" dir="ltr">
            {code.code}
          </code>
          <span className={clsx("chip", chip)}>{label}</span>
          <span className="chip bg-card-soft text-ink-muted">{code.source === "kingshot" ? `From ${KINGSHOT_SITE}` : "Added by hand"}</span>
        </p>
        <p className={clsx("text-sm", code.rewards ? "text-ink" : "text-ink-faint")}>{code.rewards || "No line yet about what it gives."}</p>
        <p className="text-xs text-ink-faint">
          Added {utcLabel(code.addedAt)} UTC · {code.expiresAt ? `Expires ${utcLabel(code.expiresAt)} UTC` : "No known expiry"}
          {code.endedAt && ` · Ended ${utcLabel(code.endedAt)} UTC (${KINGSHOT_SITE} stopped listing it)`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-tour="gift-codes-actions">
        <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>
          {editing ? "Close" : "Edit"}
        </button>
        {canHide && (
          <form action={showAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={code.id} />
            <input type="hidden" name="shown" value={code.state === "home" ? "0" : "1"} />
            <button type="submit" className="btn-ghost btn-sm" disabled={showing}>
              {code.state === "home" ? "Hide from Home" : "Show on Home"}
            </button>
          </form>
        )}
        {deletable && (
          <form
            action={deleteAction}
            onSubmit={(event) => {
              if (!window.confirm(`Delete ${code.code}?`)) event.preventDefault();
            }}
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={code.id} />
            <button type="submit" className="btn-ghost btn-sm text-danger" disabled={deleting}>
              Delete
            </button>
          </form>
        )}
      </div>
      <Notice state={showState.status === "error" ? showState : deleteState} />
      {editing && (
        <div className="rounded-xl border border-line p-4">
          <CodeForm locale={locale} code={code} />
        </div>
      )}
    </li>
  );
}

/** Add a code (no `code`), or edit what one gives and when it expires. */
function CodeForm({ locale, code }: { locale: string; code?: AdminGiftCode }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(code ? saveGiftCode : addGiftCode, IDLE_STATE);
  // Editing keeps what was saved on screen; the add form keeps React's reset, so it clears after an add.
  const submit = useSubmitInTransition(formAction);
  const errors = state.errors ?? {};
  const key = code?.id ?? "new";
  return (
    <form action={formAction} onSubmit={code ? submit : undefined} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {code && <input type="hidden" name="id" value={code.id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!code && (
          <Field label="Code" htmlFor="gift-code-new" error={errors.code} hint={CODE_HINT} tour="gift-codes-code">
            <input id="gift-code-new" name="code" className="input font-bold tracking-wider" dir="ltr" autoComplete="off" spellCheck={false} autoCapitalize="none" required />
          </Field>
        )}
        <Field
          label="What it gives (optional)"
          htmlFor={`gift-rewards-${key}`}
          error={errors.rewards}
          hint={`In English, up to ${MAX_REWARDS} characters, e.g. “200 gems and 3 × 5-minute speedups”. Translated for the other languages by itself.`}
          tour={code ? undefined : ADD_FORM.rewardsTour}
        >
          <input id={`gift-rewards-${key}`} name="rewards" className="input" dir="auto" maxLength={MAX_REWARDS} defaultValue={code?.rewards ?? ""} autoComplete="off" />
        </Field>
      </div>
      <DateTimeField
        id={`gift-expires-${key}`}
        name="expiresAt"
        label="Expires (UTC, optional)"
        defaultValue={toUtcInputValue(code?.expiresAt)}
        hint={`Leave it empty when nobody knows. A date from ${KINGSHOT_SITE}, when it has one, replaces it.`}
        error={errors.expiresAt}
        allowPast={Boolean(code)}
        tour={code ? undefined : ADD_FORM.expiryTour}
      />
      <button type="submit" className="btn-primary btn-sm" disabled={pending}>
        {code ? "Save" : "Add to Home"}
      </button>
      <Notice state={state} />
    </form>
  );
}
