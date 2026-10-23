import { ArrowRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { EventList } from "@/components/events/EventList";
import { AllianceGrid } from "@/components/home/AllianceGrid";
import { Announcements } from "@/components/home/Announcements";
import { GiftCodes } from "@/components/home/GiftCodes";
import { ServerClock } from "@/components/time/ServerClock";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getAlliances, getAnnouncements, getEvents, getGiftCodes, getSettings } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { pick } from "@/lib/i18n/localized";
import { localePath } from "@/lib/i18n/paths";

export default async function HomePage() {
  const locale = await rootLocale();
  const [settings, dict, announcements, events, alliances, giftCodes] = await Promise.all([
    getSettings(),
    getDictionary(locale),
    getAnnouncements(),
    getEvents(),
    getAlliances(),
    getGiftCodes(),
  ]);

  return (
    <div className="space-y-10 md:space-y-14">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] border border-line bg-card p-6 shadow-lift md:p-10">
        <div
          className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-gold/25 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -start-10 size-64 rounded-full bg-primary/20 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <p className="chip bg-gold-soft text-gold-strong">Kingshot · #{settings.kingdomNumber}</p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-ink md:text-5xl" dir="auto">{pick(settings.kingdomName, locale)}</h1>
          <p className="mt-3 max-w-2xl text-base font-semibold text-ink-muted md:text-lg" dir="auto">{pick(settings.tagline, locale)}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={localePath(locale, "/events")} className="btn-primary">
              {dict["nav.events"]} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
            <Link href={localePath(locale, "/guides")} className="btn-gold">
              {dict["nav.guides"]}
            </Link>
            {settings.discordInviteUrl && (
              <a href={settings.discordInviteUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                <MessageCircle className="size-4" aria-hidden /> {dict["home.joinDiscord"]}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Server clock & reset */}
      <section aria-label={dict["time.serverTime"]}>
        <ServerClock dict={dict} locale={locale} resetHourUtc={settings.dailyResetUtcHour} />
      </section>

      {/* Announcements */}
      <section>
        <SectionTitle icon="📣" title={dict["home.announcements"]} />
        <Announcements announcements={announcements} dict={dict} locale={locale} />
      </section>

      {/* Upcoming events */}
      <section>
        <SectionTitle
          icon="📅"
          title={dict["home.upcomingEvents"]}
          action={
            <Link href={localePath(locale, "/events")} className="btn-ghost btn-sm">
              {dict["home.viewAllEvents"]} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          }
        />
        <EventList events={events} dict={dict} locale={locale} limit={4} />
      </section>

      {/* Alliances */}
      <section>
        <SectionTitle icon="🛡️" title={dict["home.alliances"]} />
        <AllianceGrid alliances={alliances} dict={dict} locale={locale} />
      </section>

      {/* Gift codes */}
      <section>
        <SectionTitle icon="🎁" title={dict["home.giftCodes"]} />
        <GiftCodes codes={giftCodes} dict={dict} locale={locale} />
      </section>
    </div>
  );
}
