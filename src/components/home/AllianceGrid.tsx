import clsx from "clsx";
import { ExternalLink, Users } from "lucide-react";
import type { Alliance } from "@/lib/data/types";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";

function formatPower(power: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(power);
}

/** Gold / silver / bronze for the top three, like the in-game ranking. */
const RANK_STYLES = [
  "bg-gold text-on-gold shadow-[0_2px_0_0_var(--gold-strong)]",
  "bg-slate-300 text-slate-800 shadow-[0_2px_0_0_#94a3b8] dark:bg-slate-400 dark:text-slate-900",
  "bg-amber-600 text-white shadow-[0_2px_0_0_#92400e]",
];

/** Alliances in the order of the `alliances` table (sort_order = in-game power rank). */
export function AllianceGrid({ alliances, dict, locale }: { alliances: Alliance[]; dict: Dictionary; locale: string }) {
  if (alliances.length === 0) return null;
  const anyPower = alliances.some((a) => a.power != null);

  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {alliances.map((alliance, index) => {
          const description = pick(alliance.description, locale);
          const requirements = pick(alliance.requirements, locale);
          const hasStats = alliance.power != null || alliance.members != null;
          return (
            <li key={alliance.id}>
              <article className="card flex h-full flex-col p-5">
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-12 shrink-0 place-items-center rounded-2xl text-sm font-black text-white shadow-[0_3px_0_0_rgba(0,0,0,0.18)]"
                    style={{ backgroundColor: alliance.color }}
                    dir="ltr"
                    aria-hidden
                  >
                    {alliance.tag}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-extrabold text-ink" dir="ltr">
                      [{alliance.tag}] {alliance.name}
                    </h3>
                    {alliance.leader && (
                      <p className="truncate text-sm text-ink-muted">
                        {dict["alliance.leader"]}: <span className="font-bold text-ink">{alliance.leader}</span>
                      </p>
                    )}
                  </div>
                  <span
                    className={clsx(
                      "grid size-8 shrink-0 place-items-center rounded-full text-xs font-black",
                      RANK_STYLES[index] ?? "bg-card-soft text-ink-muted",
                    )}
                    aria-label={`${dict["alliance.rank"]} ${index + 1}`}
                  >
                    {index + 1}
                  </span>
                </div>

                {hasStats && (
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    {alliance.power != null && (
                      <div className="rounded-xl bg-card-soft px-3 py-2">
                        <dt className="text-xs font-bold text-ink-faint">{dict["alliance.power"]}</dt>
                        <dd className="font-extrabold text-ink tabular" title={alliance.power.toLocaleString("en-US")}>
                          {formatPower(alliance.power, locale)}
                        </dd>
                      </div>
                    )}
                    {alliance.members != null && (
                      <div className="rounded-xl bg-card-soft px-3 py-2">
                        <dt className="flex items-center gap-1 text-xs font-bold text-ink-faint">
                          <Users className="size-3" aria-hidden />
                          {dict["alliance.members"]}
                        </dt>
                        <dd className="font-extrabold text-ink tabular">
                          {alliance.members} / {alliance.maxMembers}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}

                {description && (
                  <p className="mt-3 text-sm text-ink-muted" dir="auto">
                    {description}
                  </p>
                )}

                {(requirements || alliance.languages) && (
                  <div className="mt-3 space-y-1 text-sm">
                    {requirements && (
                      <p>
                        <span className="font-bold text-ink-muted">{dict["alliance.requirements"]}:</span>{" "}
                        <span className="text-ink" dir="auto">
                          {requirements}
                        </span>
                      </p>
                    )}
                    {alliance.languages && (
                      <p>
                        <span className="font-bold text-ink-muted">{dict["alliance.languages"]}:</span>{" "}
                        <span className="text-ink">{alliance.languages}</span>
                      </p>
                    )}
                  </div>
                )}

                {alliance.discordUrl && (
                  <a href={alliance.discordUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm mt-auto self-start pt-2">
                    Discord <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                )}
              </article>
            </li>
          );
        })}
      </ul>
      {anyPower && <p className="mt-2 text-xs font-semibold text-ink-faint">{dict["home.alliancesHint"]}</p>}
    </div>
  );
}
