import { Pin } from "lucide-react";
import { RichText } from "@/components/content/RichText";
import type { Announcement } from "@/lib/data/types";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";

export function Announcements({
  announcements,
  dict,
  locale,
}: {
  announcements: Announcement[];
  dict: Dictionary;
  locale: string;
}) {
  // Expired announcements are already filtered out by the data layer.
  const visible = announcements;

  if (visible.length === 0) {
    return <p className="card px-5 py-6 text-center font-semibold text-ink-muted">{dict["home.noAnnouncements"]}</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-3">
      {visible.map((announcement) => (
        <li key={announcement.id}>
          <article className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              {announcement.pinned && (
                <span className="chip bg-gold-soft text-gold-strong">
                  <Pin className="size-3" aria-hidden />
                  {dict["home.pinned"]}
                </span>
              )}
              <time className="text-xs font-bold text-ink-faint" dateTime={announcement.publishedAt}>
                {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
                  new Date(announcement.publishedAt),
                )}
              </time>
            </div>
            <h3 className="mt-1.5 text-lg font-extrabold text-ink" dir="auto">{pick(announcement.title, locale)}</h3>
            <RichText html={pick(announcement.body, locale)} className="mt-2 text-[0.98rem]" />
          </article>
        </li>
      ))}
    </ul>
  );
}
