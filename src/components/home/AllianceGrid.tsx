import { ExternalLink, Users } from "lucide-react";
import type { Alliance } from "@/lib/data/types";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";

function formatPower(power: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(power);
}

export function AllianceGrid({ alliances, dict, locale }: { alliances: Alliance[]; dict: Dictionary; locale: string }) {
  if (alliances.length === 0) return null;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {alliances.map((alliance) => (
        <li key={alliance.id}>
          <article className="card flex h-full flex-col p-5">
            <div className="flex items-center gap-3">
              <span
                className="grid size-12 shrink-0 place-items-center rounded-2xl text-sm font-black text-white shadow-[0_3px_0_0_rgba(0,0,0,0.18)]"
                style={{ backgroundColor: alliance.color }}
                aria-hidden
              >
                {alliance.tag}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-extrabold text-ink">
                  [{alliance.tag}] {alliance.name}
                </h3>
                {alliance.leader && (
                  <p className="truncate text-sm text-ink-muted">
                    {dict["alliance.leader"]}: <span className="font-bold text-ink">{alliance.leader}</span>
                  </p>
                )}
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-card-soft px-3 py-2">
                <dt className="text-xs font-bold text-ink-faint">{dict["alliance.power"]}</dt>
                <dd className="tabular font-extrabold text-ink">{alliance.power != null ? formatPower(alliance.power, locale) : "—"}</dd>
              </div>
              <div className="rounded-xl bg-card-soft px-3 py-2">
                <dt className="flex items-center gap-1 text-xs font-bold text-ink-faint">
                  <Users className="size-3" aria-hidden />
                  {dict["alliance.members"]}
                </dt>
                <dd className="tabular font-extrabold text-ink">
                  {alliance.members != null ? `${alliance.members} / ${alliance.maxMembers}` : "—"}
                </dd>
              </div>
            </dl>

            {pick(alliance.description, locale) && (
              <p className="mt-3 text-sm text-ink-muted">{pick(alliance.description, locale)}</p>
            )}

            <div className="mt-3 space-y-1 text-sm">
              {pick(alliance.requirements, locale) && (
                <p>
                  <span className="font-bold text-ink-muted">{dict["alliance.requirements"]}:</span>{" "}
                  <span className="text-ink">{pick(alliance.requirements, locale)}</span>
                </p>
              )}
              {alliance.languages && (
                <p>
                  <span className="font-bold text-ink-muted">{dict["alliance.languages"]}:</span>{" "}
                  <span className="text-ink">{alliance.languages}</span>
                </p>
              )}
            </div>

            {alliance.discordUrl && (
              <a
                href={alliance.discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost btn-sm mt-auto self-start pt-2"
              >
                Discord <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </article>
        </li>
      ))}
    </ul>
  );
}
