// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { BadgeCheck, CircleCheck, LoaderCircle, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import type { Buff, ScoringDay } from "@/lib/kvk/prep";
import { lookupMinistryGovernor, myMinistrySignups, submitMinistrySignup, withdrawMinistrySignup, type LookupState, type MySignup, type SubmitState } from "@/lib/ministry/actions";
import { FIELD, type SignupErrorCode } from "@/lib/ministry/form";
import { type Amounts, BUFF_FIELDS, NO_AMOUNTS, type ResourceField, scoredInPoints, sectionScore, slotLabel, slotRuns, speedupMinutes, splitSpeedup } from "@/lib/ministry/ministry";
import { GAME_NAME_MAX } from "@/lib/retro/config";
import { isGovernorId, NO_ALLIANCE, normalizeGovernorId } from "@/lib/retro/form";
import { formatLocalDateTime, formatUtcTime } from "@/lib/time";
import { ItemIcon } from "../kvk/ItemIcon";
import { formatDuration } from "../time/DurationLabel";
import { useNow } from "../time/useNow";
import { useDeviceKey } from "./device-key";
import { MinistryRoster, type RosterDay } from "./MinistryRoster";
import { BUFF_ICON, BUFF_IMAGES, RESOURCE_ICON, RESOURCE_IMAGES } from "./icons";
import { SlotPicker } from "./SlotPicker";

/**
 * The player's side of the ministry sign-ups: the entries this browser made
 * (changed or withdrawn here until each day's deadline) and the form, one
 * card per buff day. The browser's key travels with its own sign-ups only.
 */

/** One buff day as the gate hands it over: plain values, dates as milliseconds. */
export interface SectionView {
  day: ScoringDay;
  buffs: Buff[];
  /** 00:00 UTC of the day. */
  start: number;
  /** "Mon, 30 Nov": the day's date, formatted in UTC on the server. */
  date: string;
  deadline: number;
}

export interface RoundView {
  key: string;
  sections: SectionView[];
}

const RESOURCE_LABEL = { truegold: "prep.item.truegold", temperedTruegold: "prep.item.temperedTruegold", tgDust: "prep.item.tgDust" } as const satisfies Record<ResourceField, string>;

const IDLE: SubmitState = { status: "idle" };

type Common = { round: RoundView; alliances: Array<{ tag: string; name: string }>; kingdom: number; lookupEnabled: boolean; dict: Dictionary; locale: string };

export function MinistrySignup(props: Common & { openDays: ScoringDay[]; rosters: RosterDay[] }) {
  const { round, dict, rosters } = props;
  const deviceKey = useDeviceKey();
  const now = useNow(15_000);
  // The server's answer until the browser's clock takes over.
  const open = now ? round.sections.filter((section) => now.getTime() < section.deadline).map((section) => section.day) : props.openDays;
  const [mine, setMine] = useState<MySignup[] | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [, startLoad] = useTransition();
  useEffect(() => {
    if (!deviceKey) return;
    startLoad(async () => {
      const rows = await myMinistrySignups(deviceKey);
      setMine(rows);
    });
  }, [deviceKey]);

  const entries = mine ?? [];
  const showForm = open.length > 0 && (editing !== null || (mine !== null && entries.length === 0));
  const entry = editing && editing !== "new" ? entries.find((row) => row.governorId === editing) : undefined;

  // This browser's own appointments, to mark them on the roster.
  const own: Partial<Record<ScoringDay, number[]>> = {};
  for (const row of entries) {
    for (const { day } of rosters) {
      const slot = row.appointments[day];
      if (typeof slot === "number") own[day] = [...(own[day] ?? []), slot];
    }
  }

  return (
    <div className="space-y-6">
      {entries.length > 0 && (
        <section className="card space-y-4 p-5" data-tour="ministry-mine">
          <div>
            <h2 className="text-lg font-extrabold text-ink">{dict["ministry.mine.title"]}</h2>
            <p className="mt-1 text-sm font-semibold text-ink-muted">{dict["ministry.mine.hint"]}</p>
          </div>
          {saved && (
            <p className="flex items-start gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm font-bold text-success" role="status">
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span dir="auto">{format(dict["ministry.saved"], { name: saved })}</span>
            </p>
          )}
          <ul className="divide-y divide-line">
            {entries.map((row) => (
              <MineRow
                key={row.governorId}
                row={row}
                round={round}
                canChange={open.length > 0}
                hydrated={now !== null}
                locale={props.locale}
                deviceKey={deviceKey}
                dict={dict}
                onEdit={() => {
                  setSaved(null);
                  setEditing(row.governorId);
                }}
                onChanged={setMine}
              />
            ))}
          </ul>
          {open.length > 0 && editing === null && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                setSaved(null);
                setEditing("new");
              }}
            >
              <Plus className="size-4" aria-hidden />
              <span>{dict["ministry.mine.another"]}</span>
            </button>
          )}
        </section>
      )}

      {showForm && deviceKey && (
        <SignupForm
          key={entry?.governorId ?? "new"}
          {...props}
          openDays={open}
          hydrated={now !== null}
          now={now}
          deviceKey={deviceKey}
          entry={entry}
          onCancel={entries.length > 0 ? () => setEditing(null) : undefined}
          onSaved={(rows, name) => {
            setMine(rows);
            setSaved(name);
            setEditing(null);
          }}
        />
      )}
      {mine === null && (
        <div className="card h-40 animate-pulse bg-card-soft" aria-hidden />
      )}
      {rosters.length > 0 && <MinistryRoster days={rosters} own={own} hydrated={now !== null} dict={dict} locale={props.locale} />}
      {open.length === 0 && entries.length === 0 && mine !== null && (
        <p className="card px-5 py-8 text-center font-semibold text-ink-muted">{dict["ministry.error.closed"]}</p>
      )}
    </div>
  );

}

function MineRow({
  row,
  round,
  canChange,
  hydrated,
  locale,
  deviceKey,
  dict,
  onEdit,
  onChanged,
}: {
  row: MySignup;
  round: RoundView;
  canChange: boolean;
  hydrated: boolean;
  locale: string;
  deviceKey: string | null;
  dict: Dictionary;
  onEdit: () => void;
  onChanged: (rows: MySignup[]) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, start] = useTransition();
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);
  const withdraw = () => {
    if (!deviceKey) return;
    if (!armed) {
      setArmed(true);
      timer.current = window.setTimeout(() => setArmed(false), 4000);
      return;
    }
    setArmed(false);
    start(async () => {
      const result = await withdrawMinistrySignup(deviceKey, row.governorId);
      if (result.status === "locked") setLocked(true);
      if (result.mine) onChanged(result.mine);
    });
  };
  return (
    <li className="space-y-2 py-4 first:pt-0 last:pb-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-base font-extrabold wrap-break-word text-ink" dir="auto">
          {row.allianceTag ? `[${row.allianceTag}] ` : ""}
          {row.gameName}
        </span>
        {row.verified && <BadgeCheck className="size-4 shrink-0 text-success" aria-hidden />}
        <span className="chip bg-card-soft text-ink-muted" dir="ltr">
          {row.governorId}
        </span>
        {row.disabled && <span className="chip bg-gold-soft text-gold-ink">{dict["ministry.mine.disabled"]}</span>}
      </p>
      <ul className="space-y-1">
        {round.sections
          .filter((section) => (row.slots[section.day]?.length ?? 0) > 0)
          .map((section) => (
            <li key={section.day} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-semibold text-ink-muted">
              <span className="font-extrabold text-ink">{section.buffs.map((buff) => dict[`prep.council.${buff}`]).join(" + ")}</span>
              <span>{section.date}</span>
              <span className="wrap-break-word tabular" dir="ltr">
                {slotRuns(row.slots[section.day] ?? [])
                  .map(([first, length]) => slotLabel(first, length))
                  .join(", ")}{" "}
                UTC
              </span>
              {row.appointments[section.day] !== undefined && <Appointment slot={row.appointments[section.day] ?? null} dayStart={section.start} hydrated={hydrated} locale={locale} dict={dict} />}
            </li>
          ))}
      </ul>
      {canChange && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          <button type="button" className="btn-ghost btn-sm" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden />
            <span>{dict["ministry.mine.edit"]}</span>
          </button>
          <button type="button" className={clsx("btn-ghost btn-sm", armed ? "border-danger text-danger" : "text-danger")} onClick={withdraw} disabled={busy}>
            <Trash2 className="size-4" aria-hidden />
            <span>{armed ? dict["ministry.mine.withdraw.confirm"] : dict["ministry.mine.withdraw"]}</span>
          </button>
        </div>
      )}
      {locked && (
        <p className="text-xs font-bold text-danger" role="alert">
          {dict["ministry.mine.locked"]}
        </p>
      )}
    </li>
  );
}
/** The player's appointment on a day whose roster is out: its half-hour in UTC and in their own time, or that they got none. */
function Appointment({ slot, dayStart, hydrated, locale, dict }: { slot: number | null; dayStart: number; hydrated: boolean; locale: string; dict: Dictionary }) {
  if (slot === null) return <span className="w-full rounded-xl bg-gold-soft px-3 py-2 text-sm font-bold text-gold-ink">{dict["ministry.mine.noAppointment"]}</span>;
  let local: string | null = null;
  if (hydrated) {
    try {
      local = new Intl.DateTimeFormat(locale, { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", numberingSystem: "latn" }).format(new Date(dayStart + slot * 30 * 60_000));
    } catch {
      local = null;
    }
  }
  return (
    <span className="w-full rounded-xl bg-success-soft px-3 py-2 text-sm font-extrabold text-success" data-appointment={slot}>
      {format(dict["ministry.mine.appointment"], { time: slotLabel(slot) })}
      {local && <span className="font-bold"> · {format(dict["ministry.mine.appointment.local"], { time: local })}</span>}
    </span>
  );
}

/** Digits of a typed amount (spaces and separators dropped), as a number; anything else 0. */
function typed(value: string | undefined): number {
  const digits = (value ?? "").replace(/[\s,.'_]/g, "");
  return /^\d{1,12}$/.test(digits) ? Number(digits) : 0;
}

function initialValues(entry: MySignup | undefined): Record<string, string> {
  if (!entry) return {};
  const show = (n: number) => (n > 0 ? String(n) : "");
  const values: Record<string, string> = { truegold: show(entry.amounts.truegold), temperedTruegold: show(entry.amounts.temperedTruegold), tgDust: show(entry.amounts.tgDust) };
  for (const buff of ["construction", "research", "training"] as const) {
    const { days, hours } = splitSpeedup(entry.amounts[BUFF_FIELDS[buff].speedups]);
    values[FIELD.days(buff)] = show(days);
    values[FIELD.hours(buff)] = show(hours);
  }
  return values;
}

function SignupForm({
  round,
  alliances,
  kingdom,
  lookupEnabled,
  dict,
  locale,
  openDays,
  hydrated,
  now,
  deviceKey,
  entry,
  onCancel,
  onSaved,
}: Common & {
  openDays: ScoringDay[];
  hydrated: boolean;
  now: Date | null;
  deviceKey: string;
  /** The sign-up being changed; none for a new one. */
  entry?: MySignup;
  onCancel?: () => void;
  onSaved: (rows: MySignup[], name: string) => void;
}) {
  const [state, setState] = useState<SubmitState>(IDLE);
  const [pending, startSubmit] = useTransition();
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSubmit(async () => {
      const result = await submitMinistrySignup(IDLE, data);
      setState(result);
      if (result.status === "ok") onSaved(result.mine ?? [], String(data.get(FIELD.gameName) ?? ""));
    });
  };

  // Governor ID check while typing, as on the feedback form: silent when MightPulse can't answer, retried when it is still fetching.
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const currentId = useRef("");
  const [gameName, setGameName] = useState(entry?.gameName ?? "");
  const knownAlliance = (tag: string | null | undefined) => (tag && alliances.some((a) => a.tag === tag) ? tag : null);
  const [alliance, setAlliance] = useState(entry ? (knownAlliance(entry.allianceTag) ?? NO_ALLIANCE) : "");
  const [checking, startLookup] = useTransition();
  const check = (raw: string, attempt = 0) => {
    const id = normalizeGovernorId(raw);
    if (entry || !lookupEnabled || !isGovernorId(id)) return;
    if (attempt === 0 && id === currentId.current) return;
    currentId.current = id;
    startLookup(async () => {
      const result = await lookupMinistryGovernor(id);
      if (currentId.current !== id) return;
      setLookup(result);
      if (result.status === "found") {
        setGameName(result.name ?? "");
        const known = knownAlliance(result.allianceTag);
        if (known) setAlliance(known);
      }
      if (result.status === "skipped" && result.retry && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        if (currentId.current === id) check(id, attempt + 1);
      }
    });
  };
  const found = lookup.status === "found";
  const nameLocked = found || Boolean(entry?.verified);
  const allianceLocked = (found && knownAlliance(lookup.allianceTag) !== null) || Boolean(entry?.verified && knownAlliance(entry.allianceTag));

  const [values, setValues] = useState<Record<string, string>>(() => initialValues(entry));
  const [joinedDays, setJoinedDays] = useState<ReadonlySet<ScoringDay>>(() => new Set(round.sections.filter((section) => (entry?.slots[section.day]?.length ?? 0) > 0).map((section) => section.day)));
  const [slots, setSlots] = useState<Partial<Record<ScoringDay, ReadonlySet<number>>>>(() =>
    Object.fromEntries(round.sections.map((section) => [section.day, new Set(entry?.slots[section.day] ?? [])])),
  );
  const amounts: Amounts = {
    ...NO_AMOUNTS,
    truegold: typed(values.truegold),
    temperedTruegold: typed(values.temperedTruegold),
    tgDust: typed(values.tgDust),
    constructionMinutes: speedupMinutes(typed(values[FIELD.days("construction")]), typed(values[FIELD.hours("construction")])),
    researchMinutes: speedupMinutes(typed(values[FIELD.days("research")]), typed(values[FIELD.hours("research")])),
    trainingMinutes: speedupMinutes(typed(values[FIELD.days("training")]), typed(values[FIELD.hours("training")])),
  };
  const number = (n: number) => {
    try {
      return new Intl.NumberFormat(locale).format(n);
    } catch {
      return String(n);
    }
  };

  /** "140 days 12 hrs", in the page's words. */
  const speedupText = (minutes: number) => {
    const { days, hours } = splitSpeedup(minutes);
    return `${number(days)} ${dict[days === 1 ? "common.day" : "common.days"]} ${hours} ${dict["common.hours"]}`;
  };

  const waitMs = state.status === "throttled" && state.retryAt && now ? Math.max(0, state.retryAt - now.getTime()) : 0;
  const waiting = state.status === "throttled" && (now === null || waitMs > 0);
  const errors = state.status === "invalid" ? (state.errors ?? {}) : {};
  const errorText = (code: SignupErrorCode | undefined): string | null => {
    if (!code) return null;
    if (code === "tooLong") return format(dict["retro.error.tooLong"], { max: GAME_NAME_MAX });
    if (code === "required" || code === "invalid") return dict[`retro.error.${code}`];
    return dict[`ministry.error.${code}`];
  };
  const governorError = state.status === "unknownGovernor" || lookup.status === "unknown" ? format(dict["retro.lookup.unknown"], { kingdom }) : errorText(errors[FIELD.governorId]);
  const notice =
    state.status === "invalid"
      ? errors[FIELD.sections]
        ? dict["ministry.error.sections"]
        : dict["retro.error.fix"]
      : state.status === "taken"
        ? dict["ministry.error.taken"]
        : state.status === "closed"
          ? dict["ministry.error.closed"]
          : state.status === "full"
            ? dict["ministry.error.full"]
            : state.status === "unknownGovernor"
              ? format(dict["retro.lookup.unknown"], { kingdom })
              : waiting
                ? format(dict["retro.error.throttled"], { time: now ? formatDuration(waitMs, dict, true) : "…" })
                : state.status === "unavailable"
                  ? dict["retro.error.unavailable"]
                  : null;

  const field = (name: string) => ({
    name,
    value: values[name] ?? "",
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues((previous) => ({ ...previous, [name]: event.target.value })),
    inputMode: "numeric" as const,
    autoComplete: "off",
    dir: "ltr" as const,
    placeholder: "0",
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      <input type="hidden" name={FIELD.round} value={round.key} />
      <input type="hidden" name={FIELD.locale} value={locale} />
      <input type="hidden" name={FIELD.deviceKey} value={deviceKey} />
      {found && lookup.token && <input type="hidden" name={FIELD.token} value={lookup.token} />}
      {/* Honeypot: people never see it, bots fill it. */}
      <div className="hidden" aria-hidden>
        <label>
          Website <input type="text" name={FIELD.honeypot} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <section className="card space-y-4 p-5" data-tour="ministry-you">
        <h2 className="text-lg font-extrabold text-ink">{dict["ministry.you"]}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
            <label htmlFor="ministry-governor" className="label mb-0">
              {dict["retro.governorId"]} <span className="chip ms-1 bg-gold-soft text-gold-ink">{dict["retro.required"]}</span>
            </label>
            <div className="relative">
              <input
                id="ministry-governor"
                name={FIELD.governorId}
                className={clsx("input pe-12", governorError && "border-danger", entry && "text-ink-muted")}
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9 .\-_]{4,24}"
                required
                maxLength={20}
                dir="ltr"
                defaultValue={entry?.governorId}
                readOnly={Boolean(entry)}
                onBlur={(event) => check(event.target.value)}
                onChange={(event) => {
                  if (normalizeGovernorId(event.target.value) !== currentId.current) {
                    currentId.current = "";
                    // The name and alliance MightPulse gave belong to the ID that was just changed: they leave with it.
                    if (lookup.status === "found") {
                      setGameName("");
                      setAlliance("");
                    }
                    setLookup({ status: "idle" });
                  }
                }}
                aria-invalid={governorError ? true : undefined}
                aria-describedby={governorError ? "ministry-governor-error" : "ministry-governor-hint"}
              />
              {checking && <LoaderCircle className="absolute inset-y-0 inset-e-4 my-auto size-5 animate-spin text-ink-faint" aria-hidden />}
              {(found || entry?.verified) && !checking && <BadgeCheck className="absolute inset-y-0 inset-e-4 my-auto size-5 text-success" aria-hidden />}
            </div>
            {governorError ? (
              <p id="ministry-governor-error" className="text-xs font-bold text-danger" role="alert">
                {governorError}
              </p>
            ) : found ? (
              <p className="text-xs font-bold text-success" role="status">
                {format(dict["retro.lookup.found"], { name: lookup.name ?? "" })}
              </p>
            ) : checking ? (
              <p className="text-xs font-semibold text-ink-faint" role="status">
                {dict["retro.lookup.checking"]}
              </p>
            ) : (
              <p id="ministry-governor-hint" className="text-xs font-semibold text-ink-faint">
                {dict["ministry.governorId.hint"]}
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="ministry-name" className="label mb-0">
              {dict["retro.name"]}
            </label>
            <input
              id="ministry-name"
              name={FIELD.gameName}
              className={clsx("input", errors[FIELD.gameName] && "border-danger", nameLocked && "text-ink-muted")}
              value={gameName}
              onChange={(event) => setGameName(event.target.value)}
              readOnly={nameLocked}
              required={!nameLocked}
              maxLength={GAME_NAME_MAX}
              autoComplete="nickname"
              dir="auto"
              aria-invalid={errors[FIELD.gameName] ? true : undefined}
            />
            {errorText(errors[FIELD.gameName]) && <p className="text-xs font-bold text-danger">{errorText(errors[FIELD.gameName])}</p>}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="ministry-alliance" className="label mb-0">
              {dict["retro.alliance"]}
            </label>
            <select
              id="ministry-alliance"
              name={FIELD.alliance}
              className={clsx("input select-chevron", errors[FIELD.alliance] && "border-danger", allianceLocked && "pointer-events-none text-ink-muted")}
              value={alliance}
              onChange={(event) => setAlliance(event.target.value)}
              required
              tabIndex={allianceLocked ? -1 : undefined}
              aria-readonly={allianceLocked || undefined}
              aria-invalid={errors[FIELD.alliance] ? true : undefined}
            >
              <option value="" disabled>
                {dict["retro.alliance.choose"]}
              </option>
              {alliances.map((a) => (
                <option key={a.tag} value={a.tag}>
                  [{a.tag}] {a.name}
                </option>
              ))}
              <option value={NO_ALLIANCE}>{dict["retro.alliance.none"]}</option>
            </select>
            {errorText(errors[FIELD.alliance]) && <p className="text-xs font-bold text-danger">{errorText(errors[FIELD.alliance])}</p>}
          </div>
        </div>
      </section>

      {round.sections.map((section) => {
        const open = openDays.includes(section.day);
        const on = joinedDays.has(section.day);
        const picked = slots[section.day] ?? new Set<number>();
        const id = `ministry-day-${section.day}`;
        const joinError = errorText(errors[FIELD.join(section.day)]);
        return (
          <section key={section.day} className={clsx("card space-y-4 p-5", on && open && "border-2 border-primary/50")} data-tour="ministry-day" aria-labelledby={`${id}-title`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex shrink-0 items-center gap-1">
                {section.buffs.map((buff) => (
                  <ItemIcon key={buff} image={BUFF_IMAGES[buff]} emoji={BUFF_ICON[buff]} className="size-9" />
                ))}
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <h3 id={`${id}-title`} className="text-lg/tight font-extrabold wrap-break-word text-ink">
                  {section.buffs.map((buff) => dict[`prep.council.${buff}`]).join(" + ")}
                </h3>
                <p className="text-sm font-semibold text-ink-muted">
                  {format(dict["prep.day"], { n: section.day })} · {section.date}
                </p>
              </div>
              {open && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() =>
                    setJoinedDays((previous) => {
                      const next = new Set(previous);
                      if (next.has(section.day)) next.delete(section.day);
                      else next.add(section.day);
                      return next;
                    })
                  }
                  className="flex min-h-11 items-center gap-2 rounded-2xl px-1 text-sm font-extrabold text-ink"
                >
                  <span>{dict["ministry.join"]}</span>
                  <span className={clsx("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-line")} aria-hidden>
                    <span className={clsx("absolute inset-y-1 size-5 rounded-full bg-white shadow-sm transition-[inset-inline-start]", on ? "inset-s-6" : "inset-s-1")} />
                  </span>
                </button>
              )}
            </div>
            <DeadlineLine deadline={section.deadline} open={open} hydrated={hydrated} dict={dict} locale={locale} />

            {!open && <p className="rounded-2xl bg-card-soft px-4 py-3 text-sm font-semibold text-ink-muted">{dict["ministry.closedDay"]}</p>}

            {open && on && (
              <>
                <input type="hidden" name={FIELD.join(section.day)} value="on" />
                {picked.size > 0 && <input type="hidden" name={FIELD.slots(section.day)} value={[...picked].sort((a, b) => a - b).join(",")} />}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {section.buffs.flatMap((buff) => [
                    ...BUFF_FIELDS[buff].resources.map((resource) => (
                      <div key={resource} className="flex min-w-0 flex-col gap-1">
                        <label htmlFor={`${id}-${resource}`} className="label mb-0 flex items-center gap-1.5">
                          <ItemIcon image={RESOURCE_IMAGES[resource]} emoji={RESOURCE_ICON[resource]} className="size-5" />
                          <span className="wrap-break-word">{dict[RESOURCE_LABEL[resource]]}</span>
                        </label>
                        <input id={`${id}-${resource}`} className={clsx("input", errors[resource] && "border-danger")} maxLength={12} {...field(resource)} aria-invalid={errors[resource] ? true : undefined} />
                        {errorText(errors[resource]) && <p className="text-xs font-bold text-danger">{errorText(errors[resource])}</p>}
                      </div>
                    )),
                    <fieldset key={`${buff}-speedups`} className="flex min-w-0 flex-col gap-1 sm:col-span-2">
                      <legend className="label mb-1 flex items-center gap-1.5">
                        <ItemIcon image={BUFF_IMAGES[buff]} emoji={BUFF_ICON[buff]} className="size-5" />
                        <span className="wrap-break-word">{dict[`ministry.speedups.${buff}`]}</span>
                      </legend>
                      <div className="grid grid-cols-2 gap-3">
                        {([FIELD.days(buff), FIELD.hours(buff)] as const).map((name, index) => (
                          <label key={name} className="flex min-w-0 items-center gap-2">
                            <input className={clsx("input", errors[name] && "border-danger")} maxLength={index === 0 ? 4 : 2} {...field(name)} aria-invalid={errors[name] ? true : undefined} />
                            <span className="shrink-0 text-sm font-bold text-ink-muted">{index === 0 ? dict["common.days"] : dict["common.hours"]}</span>
                          </label>
                        ))}
                      </div>
                      {(errors[FIELD.days(buff)] || errors[FIELD.hours(buff)]) && (
                        <p className="text-xs font-bold text-danger">{errorText(errors[FIELD.days(buff)] ?? errors[FIELD.hours(buff)])}</p>
                      )}
                    </fieldset>,
                  ])}
                </div>
                <p className="text-xs font-semibold text-ink-faint">{dict["ministry.speedups.hint"]}</p>
                <p className={clsx("rounded-2xl px-4 py-3 text-sm font-extrabold", joinError ? "bg-danger-soft text-danger" : "bg-gold-soft text-gold-ink")} role={joinError ? "alert" : undefined}>
                  {joinError ??
                    (scoredInPoints(section)
                      ? format(dict["ministry.score"], { points: number(sectionScore(section, amounts)) })
                      : format(dict["ministry.rank.speedups"], { time: speedupText(amounts.trainingMinutes) }))}
                </p>
                <SlotPicker
                  id={id}
                  dayStart={section.start}
                  picked={picked}
                  onChange={(next) => setSlots((previous) => ({ ...previous, [section.day]: next }))}
                  hydrated={hydrated}
                  error={errorText(errors[FIELD.slots(section.day)])}
                  labels={{
                    title: dict["ministry.slots.title"],
                    hint: dict["ministry.slots.hint"],
                    utc: dict["ministry.slots.utc"],
                    local: dict["ministry.slots.local"],
                    all: dict["ministry.slots.all"],
                    clear: dict["ministry.slots.clear"],
                  }}
                  locale={locale}
                  tour="ministry-slots"
                />
              </>
            )}
          </section>
        );
      })}

      {notice && (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-danger" suppressHydrationWarning>
          {notice}
        </p>
      )}

      <div className="flex flex-col items-stretch gap-x-2 gap-y-3 sm:flex-row sm:items-center sm:justify-end" data-tour="ministry-send">
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={pending}>
            {dict["ministry.cancel"]}
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={pending || waiting || state.status === "closed" || state.status === "full"}>
          {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Send className="size-5 rtl:-scale-x-100" aria-hidden />}
          <span>{pending ? dict["ministry.sending"] : entry ? dict["ministry.save"] : dict["ministry.submit"]}</span>
        </button>
      </div>
    </form>
  );
}

/** "Sign up until Sat 28 Nov, 01:00" on the visitor's clock (UTC until the page runs in the browser), or that the day is closed. */
export function DeadlineLine({ deadline, open, hydrated, dict, locale }: { deadline: number; open: boolean; hydrated: boolean; dict: Dictionary; locale: string }) {
  if (!open) return <p className="chip bg-card-soft text-ink-muted">{dict["ministry.deadline.passed"]}</p>;
  const at = new Date(deadline);
  let time: string;
  try {
    time = hydrated ? formatLocalDateTime(at, locale) : `${new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(at)}, ${formatUtcTime(at)}`;
  } catch {
    time = `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  }
  return (
    <p className="chip bg-gold-soft text-gold-ink" suppressHydrationWarning>
      {format(dict["ministry.deadline"], { time })}
    </p>
  );
}
