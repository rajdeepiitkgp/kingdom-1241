"use client";

import clsx from "clsx";
import { useActionState, useState } from "react";
import { type ActionState, IDLE_STATE } from "@/lib/admin/action-state";
import { utcLabel } from "@/lib/admin/format";
import type { AllianceSettings as Settings, OwnerAlliance } from "@/lib/admin/settings-data";
import { addAllianceByHand, addAllianceFromRanking, removeAlliance, saveAlliance, setAllianceShown, syncAlliancesNow } from "@/lib/admin/settings-actions";
import { nextAllianceColor, POWER_HINT } from "@/lib/alliances/forms";
import type { MightPulseAlliance } from "@/lib/alliances/mightpulse-data";
import { BATTLE_ALLIANCE_TAGS, DAILY_SYNC_UTC, heldForReview, homeRanking, TOP_ALLIANCES } from "@/lib/alliances/sync-plan";
import { useSubmitInTransition } from "@/components/ui/useSubmitInTransition";
import { Field, Notice } from "./ui";

/** The owner's alliances: synced from MightPulse every day, typed by hand while it is down. */

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });
const power = (value: number | null) => (value === null ? "—" : compact.format(value));

function stats(row: { power: number | null; leader: string | null; members: number | null }): string {
  return `Power ${power(row.power)} · Leader ${row.leader ?? "—"} · ${row.members ?? "—"} ${row.members === 1 ? "member" : "members"}`;
}

export function AllianceSettings({ settings, locale }: { settings: Settings; locale: string }) {
  if (!settings.migrated) {
    return <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">The database doesn&apos;t have the alliance columns yet (migration 0017). Reload once the deploy has finished.</p>;
  }
  if (!settings.available) return <p className="text-sm font-bold text-danger">The alliances could not be read from the database.</p>;
  const tracked = new Set(settings.alliances.map((alliance) => alliance.aid).filter((aid) => aid !== null));
  // Ranked without the battle alliances, which top the ranking on battle day.
  const ranking = homeRanking(settings.sync.board, settings.sync.battle);
  const held = heldForReview(ranking, tracked);
  return (
    <div className="space-y-6">
      <SyncStatus settings={settings} locale={locale} />
      {held.length > 0 && (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm font-bold text-gold-ink">
          Held for review: {held.map((row) => `[${row.tag}] ${row.name} (rank ${row.rank})`).join(", ")} {held.length === 1 ? "is" : "are"} in the top{" "}
          {TOP_ALLIANCES} but not on the list, so not on Home. Add from the ranking below if it belongs there.
        </p>
      )}
      <ul className="divide-y divide-line" data-tour="settings-alliances-list">
        {settings.alliances.map((alliance) => (
          <AllianceRow key={alliance.id} alliance={alliance} ranking={ranking} locale={locale} />
        ))}
        {settings.alliances.length === 0 && <li className="py-3 text-sm text-ink-muted">No alliances on the list yet: add them from the ranking below.</li>}
      </ul>
      <Ranking ranking={ranking} battle={settings.sync.battle} boardAt={settings.sync.boardAt} tracked={tracked} locale={locale} />
      <details className="rounded-xl border border-line p-4" data-tour="settings-alliances-hand">
        <summary className="cursor-pointer font-bold text-ink">Add one by hand (when MightPulse is down)</summary>
        <div className="mt-4">
          <AllianceForm action={addAllianceByHand} locale={locale} initial={{ color: nextAllianceColor(settings.alliances.map((alliance) => alliance.color)) }} submit="Add" />
        </div>
      </details>
    </div>
  );
}

function SyncStatus({ settings, locale }: { settings: Settings; locale: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(syncAlliancesNow, IDLE_STATE);
  const { sync, configured } = settings;
  const [text, tone] = !configured
    ? ["MightPulse isn't set up (no MIGHTPULSE_API_KEY in Vercel), so nothing syncs: edit the numbers by hand.", "text-ink-muted"]
    : !sync.at
      ? [`Not synced yet. The daily sync runs at ${DAILY_SYNC_UTC} UTC; Sync now does it at once.`, "text-ink-muted"]
      : sync.ok
        ? [
            `Last sync ${utcLabel(sync.at)} UTC (${sync.by === "now" ? "Sync now" : "daily"}): ${sync.synced} updated${sync.problem ? `, ${sync.problem}` : ""}.`,
            sync.problem ? "text-danger" : "text-success",
          ]
        : [`Last sync ${utcLabel(sync.at)} UTC failed: ${sync.problem ?? "MightPulse didn't answer"}. The numbers stay as they were; edit them by hand if needed.`, "text-danger"];
  return (
    <form action={action} className="space-y-3" data-tour="settings-alliances-sync">
      <input type="hidden" name="locale" value={locale} />
      <p className={clsx("text-sm font-bold", tone)}>{text}</p>
      {configured && sync.ok && sync.battleDay && (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm font-bold text-gold-ink">
          Battle day: the players are in [KvK] and [TMP], so this sync kept the alliances&apos; power, members and leaders from before the battle. From
          noon UTC the day after, syncs update them again.
        </p>
      )}
      <button type="submit" className="btn-primary btn-sm" disabled={pending || !configured}>
        {pending ? "Syncing… (up to a minute)" : "Sync now"}
      </button>
      <Notice state={state} />
    </form>
  );
}

function sourceLine(alliance: OwnerAlliance): string {
  const link = alliance.aid === null ? " Not linked to MightPulse yet: the next sync links it by its tag." : "";
  if (alliance.source === "mightpulse") return `From MightPulse, ${utcLabel(alliance.statsAt)} UTC.${link}`;
  if (alliance.source === "manual") return `Typed by hand ${utcLabel(alliance.statsAt)} UTC; the next sync from MightPulse replaces it.${link}`;
  return `From the first setup (the in-game ranking).${link}`;
}

function AllianceRow({ alliance, ranking, locale }: { alliance: OwnerAlliance; ranking: MightPulseAlliance[]; locale: string }) {
  const [editing, setEditing] = useState(false);
  const [showState, showAction, showing] = useActionState<ActionState, FormData>(setAllianceShown, IDLE_STATE);
  const [removeState, removeAction, removing] = useActionState<ActionState, FormData>(removeAlliance, IDLE_STATE);
  const rank = alliance.aid !== null ? (ranking.find((row) => row.aid === alliance.aid)?.rank ?? null) : null;
  const unranked = alliance.aid !== null && ranking.length > 0 && rank === null;
  return (
    <li className="space-y-2 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 size-4 shrink-0 rounded-full" style={{ backgroundColor: alliance.color }} aria-hidden />
        <div className={clsx("min-w-0 flex-1 space-y-0.5", !alliance.published && "opacity-70")}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-ink">
            <span dir="ltr">
              [{alliance.tag}] {alliance.name}
            </span>
            <span className={clsx("chip", alliance.published ? "bg-success-soft text-success" : "bg-card-soft text-ink-muted")}>{alliance.published ? "On Home" : "Hidden"}</span>
            {rank !== null && (
              <span className={clsx("chip", rank > TOP_ALLIANCES ? "bg-gold-soft text-gold-ink" : "bg-card-soft text-ink-muted")}>
                {rank > TOP_ALLIANCES ? `Rank ${rank} (below the top ${TOP_ALLIANCES})` : `Rank ${rank}`}
              </span>
            )}
            {unranked && <span className="chip bg-gold-soft text-gold-ink">Not in MightPulse&apos;s top 100</span>}
          </p>
          <p className="text-xs text-ink-muted">{stats(alliance)}</p>
          <p className="text-xs text-ink-faint">{sourceLine(alliance)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3 ps-7">
        <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>
          {editing ? "Close" : "Edit"}
        </button>
        <form action={showAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={alliance.id} />
          <input type="hidden" name="shown" value={alliance.published ? "0" : "1"} />
          <button type="submit" className="btn-ghost btn-sm" disabled={showing}>
            {alliance.published ? "Hide from Home" : "Show on Home"}
          </button>
        </form>
        <form
          action={removeAction}
          onSubmit={(event) => {
            if (!window.confirm(`Remove [${alliance.tag}] ${alliance.name} from the list and from Home?`)) event.preventDefault();
          }}
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={alliance.id} />
          <button type="submit" className="btn-ghost btn-sm text-danger" disabled={removing}>
            Remove
          </button>
        </form>
      </div>
      <Notice state={showState} className="ms-7" />
      <Notice state={removeState} className="ms-7" />
      {editing && (
        <div className="ms-7 rounded-xl border border-line p-4">
          <AllianceForm action={saveAlliance} locale={locale} initial={alliance} id={alliance.id} submit="Save" />
        </div>
      )}
    </li>
  );
}

function Ranking({
  ranking,
  battle,
  boardAt,
  tracked,
  locale,
}: {
  ranking: MightPulseAlliance[];
  battle: MightPulseAlliance[];
  boardAt: string | null;
  tracked: Set<number>;
  locale: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addAllianceFromRanking, IDLE_STATE);
  return (
    <div className="space-y-2" data-tour="settings-alliances-ranking">
      <h3 className="text-base font-extrabold text-ink">MightPulse ranking</h3>
      {ranking.length === 0 ? (
        <p className="text-sm text-ink-muted">The kingdom&apos;s power ranking comes with the first sync.</p>
      ) : (
        <>
          <p className="text-xs text-ink-faint">
            The kingdom&apos;s power ranking as MightPulse took it {utcLabel(boardAt)} UTC, without the battle alliances. Add puts an alliance on the list and
            on Home.
          </p>
          <ol className="divide-y divide-line">
            {ranking.slice(0, 10).map((row) => (
              <li key={row.aid} className="flex items-center gap-3 py-2">
                <span className="w-8 shrink-0 text-end font-black text-ink-muted tabular">{row.rank ?? "—"}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold wrap-break-word text-ink">
                    <span dir="ltr">
                      [{row.tag}] {row.name}
                    </span>
                    {!tracked.has(row.aid) && (row.rank ?? Number.MAX_SAFE_INTEGER) <= TOP_ALLIANCES && <span className="chip bg-gold-soft text-gold-ink">Held for review</span>}
                  </p>
                  <p className="text-xs text-ink-muted">{stats(row)}</p>
                </div>
                {tracked.has(row.aid) ? (
                  <span className="chip shrink-0 bg-success-soft text-success">On the list</span>
                ) : (
                  <form action={action} className="shrink-0">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="aid" value={row.aid} />
                    <button type="submit" className="btn-ghost btn-sm" disabled={pending}>
                      Add
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="text-xs text-ink-faint" data-tour="settings-alliances-battle">
        <span className="font-bold text-ink-muted">Battle alliances</span> (every player joins one for the castle battle and KvK; never on Home, never ranked
        with the others):{" "}
        {[
          ...battle.map((row) => `[${row.tag}] ${row.name}: ${stats(row)}`),
          ...BATTLE_ALLIANCE_TAGS.filter((tag) => !battle.some((row) => row.tag === tag)).map((tag) => `[${tag}]: not found in MightPulse yet`),
        ].join("; ")}
        .
      </p>
      <Notice state={state} />
    </div>
  );
}

function AllianceForm({
  action,
  locale,
  initial,
  id,
  submit,
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  locale: string;
  initial: Partial<Pick<OwnerAlliance, "tag" | "name" | "color" | "power" | "leader" | "members">>;
  id?: string;
  submit: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, IDLE_STATE);
  // Editing keeps what was saved on screen; the add form keeps React's reset, so it clears after an add.
  const keepOnScreen = useSubmitInTransition(formAction);
  const errors = state.errors ?? {};
  const key = id ?? "new";
  return (
    <form action={formAction} onSubmit={id ? keepOnScreen : undefined} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tag" htmlFor={`alliance-tag-${key}`} error={errors.tag} hint="Exactly as in the game: [NAM] and [Nam] are different alliances.">
          <input id={`alliance-tag-${key}`} name="tag" className="input" dir="ltr" defaultValue={initial.tag ?? ""} autoComplete="off" required />
        </Field>
        <Field label="Name" htmlFor={`alliance-name-${key}`} error={errors.name}>
          <input id={`alliance-name-${key}`} name="name" className="input" dir="ltr" defaultValue={initial.name ?? ""} autoComplete="off" required />
        </Field>
        <Field label="Power" htmlFor={`alliance-power-${key}`} error={errors.power} hint={POWER_HINT}>
          <input
            id={`alliance-power-${key}`}
            name="power"
            className="input tabular"
            dir="ltr"
            inputMode="decimal"
            defaultValue={initial.power != null ? initial.power.toLocaleString("en") : ""}
            autoComplete="off"
          />
        </Field>
        <Field label="Leader" htmlFor={`alliance-leader-${key}`} error={errors.leader}>
          <input id={`alliance-leader-${key}`} name="leader" className="input" dir="auto" defaultValue={initial.leader ?? ""} autoComplete="off" />
        </Field>
        <Field label="Members" htmlFor={`alliance-members-${key}`} error={errors.members}>
          <input id={`alliance-members-${key}`} name="members" type="number" inputMode="numeric" min={0} className="input" defaultValue={initial.members ?? ""} />
        </Field>
        <Field label="Colour on Home" htmlFor={`alliance-color-${key}`} error={errors.color}>
          <input id={`alliance-color-${key}`} name="color" type="color" className="h-11 w-20 cursor-pointer rounded-xl border border-line bg-card" defaultValue={initial.color ?? "#3b7fe4"} />
        </Field>
      </div>
      <p className="text-xs text-ink-faint">Power, leader and members saved here count as typed by hand until the next sync from MightPulse replaces them.</p>
      <button type="submit" className="btn-primary btn-sm" disabled={pending}>
        {submit}
      </button>
      <Notice state={state} />
    </form>
  );
}
