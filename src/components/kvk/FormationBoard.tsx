"use client";

import clsx from "clsx";
import { Check, Circle, Copy, ListChecks, Swords } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Hero, KvkFormation, TroopType } from "@/lib/data/types";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";
import {
  availableFilters,
  filterFormations,
  formationSummary,
  openSlots,
  ratioLabel,
  sortFormations,
  type FormationFilter,
} from "@/lib/kvk/formations";
import { HeroAvatar } from "./HeroAvatar";
import { TroopRatioBar } from "./TroopRatioBar";

/**
 * The interactive list of formations: filter chips, a per-formation
 * "saved in game" checklist (kept in this browser only) and copy buttons.
 */

// --- "saved" checklist in localStorage, read through useSyncExternalStore ---
const CHANGE_EVENT = "kd1241:kvk-progress";
const storageKey = (planId: string) => `kd1241_kvk_saved_${planId}`;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readRaw(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeSaved(key: string, ids: string[]) {
  try {
    if (ids.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Private mode / storage blocked: the checklist just doesn't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function parseSaved(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const SIDE_CHIP: Record<string, string> = {
  attack: "bg-danger-soft text-danger",
  defense: "bg-success-soft text-success",
};
const SIDE_ICON: Record<string, string> = { attack: "⚔️", defense: "🛡️" };
const ROLE_ICON: Record<string, string> = { rally_lead: "👑", rally_join: "🤝" };

export function FormationBoard({
  planId,
  formations,
  heroes,
  minSkillLevel,
  dict,
  locale,
}: {
  planId: string;
  formations: KvkFormation[];
  heroes: Hero[];
  minSkillLevel: number;
  dict: Dictionary;
  locale: string;
}) {
  const key = storageKey(planId);
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => "");
  const saved = useMemo(() => new Set(parseSaved(raw)), [raw]);

  const [filter, setFilter] = useState<FormationFilter>("all");
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);

  const heroBySlug = useMemo(() => new Map(heroes.map((h) => [h.slug, h])), [heroes]);
  const sorted = useMemo(() => sortFormations(formations), [formations]);
  const filters = availableFilters(sorted);
  const visible = filterFormations(sorted, filter);
  const done = sorted.filter((f) => saved.has(f.id)).length;
  const total = sorted.length;

  const troopLabels: Record<TroopType, string> = {
    infantry: dict["tools.refill.infantry"],
    cavalry: dict["tools.refill.cavalry"],
    archers: dict["tools.refill.archers"],
  };
  const otherHeroes = (n: number) => (n === 1 ? dict["kvk.otherHero"] : format(dict["kvk.otherHeroes"], { n }));
  const heroNames = (f: KvkFormation) =>
    f.heroSlugs.flatMap((slug) => {
      if (!slug) return [];
      const hero = heroBySlug.get(slug);
      return [hero ? pick(hero.name, locale) : slug];
    });
  const filterLabel = (value: FormationFilter) =>
    value === "all" ? dict["kvk.filter.all"] : value === "attack" || value === "defense" ? dict[`kvk.side.${value}`] : dict[`kvk.role.${value}`];

  function toggleSaved(id: string) {
    const next = new Set(saved);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeSaved(key, [...next]);
  }

  async function copy(f: KvkFormation) {
    try {
      await navigator.clipboard.writeText(formationSummary(f, heroNames(f), { troops: troopLabels, otherHeroes }));
      setCopied(f.id);
    } catch {
      // Clipboard blocked — the card is still readable.
    }
  }

  if (total === 0) {
    return <p className="card px-5 py-6 text-center font-semibold text-ink-muted">{dict["kvk.noFormations"]}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="card-soft flex flex-wrap items-center gap-3 px-4 py-3">
        <ListChecks className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-ink" aria-live="polite">
            {format(dict["kvk.progress"], { done, total })}
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
            <div className="h-full rounded-full bg-success transition-[width] duration-300" style={{ width: `${(done / total) * 100}%` }} />
          </div>
        </div>
        {done > 0 && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => writeSaved(key, [])}>
            {dict["kvk.resetProgress"]}
          </button>
        )}
      </div>
      {done === total && (
        <p className="rounded-2xl bg-success-soft px-4 py-3 text-center text-sm font-extrabold text-success">🎉 {dict["kvk.progressDone"]}</p>
      )}

      {/* Filters (only when the council tagged formations) */}
      {filters.length > 1 && (
        <div className="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label={dict["kvk.formations"]}>
          {filters.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={clsx(
                "chip shrink-0 border px-3 py-1.5 text-sm transition-colors",
                filter === value ? "border-primary bg-primary text-primary-ink" : "border-line bg-card text-ink-muted hover:border-primary hover:text-ink",
              )}
            >
              {value !== "all" && <span aria-hidden>{SIDE_ICON[value] ?? ROLE_ICON[value]}</span>}
              {filterLabel(value)}
            </button>
          ))}
        </div>
      )}

      {/* Cards */}
      {visible.length === 0 ? (
        <p className="card px-5 py-6 text-center font-semibold text-ink-muted">{dict["kvk.noFormations"]}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((f) => {
            const isSaved = saved.has(f.id);
            const names = heroNames(f);
            const open = openSlots(f);
            const line = [...names, ...(open > 0 ? [otherHeroes(open)] : [])].join(" + ");
            const note = pick(f.note, locale);
            const untagged = f.side === "any" && f.role === "any";
            return (
              <li key={f.id}>
                <article className={clsx("card flex h-full flex-col gap-4 p-4 transition-shadow", isSaved && "ring-4 ring-success/30")}>
                  <header className="flex items-center gap-3">
                    <span
                      className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold text-2xl font-black text-gold-ink shadow-[0_3px_0_0_var(--gold-strong)]"
                      dir="ltr"
                    >
                      {f.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1.5">
                        {f.side !== "any" && (
                          <span className={clsx("chip", SIDE_CHIP[f.side])}>
                            <span aria-hidden>{SIDE_ICON[f.side]}</span> {dict[`kvk.side.${f.side}`]}
                          </span>
                        )}
                        {f.role !== "any" && (
                          <span className="chip bg-primary-soft text-primary">
                            <span aria-hidden>{ROLE_ICON[f.role]}</span> {dict[`kvk.role.${f.role}`]}
                          </span>
                        )}
                        {untagged && (
                          <span className="chip bg-card-soft text-ink-muted">
                            <Swords className="size-3" aria-hidden /> {dict["kvk.side.any"]}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-ink-muted" dir="auto" title={line}>
                        {line}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={isSaved}
                      aria-label={isSaved ? dict["kvk.markSaved"] : dict["kvk.markNotSaved"]}
                      onClick={() => toggleSaved(f.id)}
                      className={clsx("btn-sm shrink-0", isSaved ? "btn-primary" : "btn-ghost")}
                    >
                      {isSaved ? <Check className="size-4" aria-hidden /> : <Circle className="size-4" aria-hidden />}
                      <span className="hidden lg:inline">{isSaved ? dict["kvk.markSaved"] : dict["kvk.markNotSaved"]}</span>
                    </button>
                  </header>

                  <div className="-mx-1 no-scrollbar flex gap-2 overflow-x-auto px-1 pt-1">
                    {f.heroSlugs.map((slug, index) => (
                      <HeroAvatar
                        key={index}
                        hero={slug ? (heroBySlug.get(slug) ?? null) : null}
                        locale={locale}
                        skillLevel={minSkillLevel}
                        anyLabel={dict["kvk.anyHero"]}
                        skillTitle={dict["kvk.skillLevel"]}
                      />
                    ))}
                  </div>

                  <div>
                    <p className="mb-1.5 flex items-center justify-between text-xs font-bold text-ink-muted">
                      <span>{dict["kvk.troopRatio"]}</span>
                      <span className="text-ink tabular" dir="ltr">
                        {ratioLabel(f)}
                      </span>
                    </p>
                    <TroopRatioBar ratio={{ infantry: f.infantry, cavalry: f.cavalry, archers: f.archers }} labels={troopLabels} />
                  </div>

                  {note && (
                    <p className="rounded-2xl bg-gold-soft px-3 py-2 text-sm font-semibold text-gold-ink" dir="auto">
                      {note}
                    </p>
                  )}

                  <footer className="mt-auto flex justify-end">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => copy(f)}>
                      {copied === f.id ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                      {copied === f.id ? dict["common.copied"] : dict["common.copy"]}
                    </button>
                  </footer>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
