import clsx from "clsx";
import { ExternalLink, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import type { ReactNode } from "react";
import { RichText } from "@/components/content/RichText";
import { formatPower } from "@/components/home/AllianceGrid";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getSettings } from "@/lib/data";
import { format } from "@/lib/i18n/dictionary";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { pick } from "@/lib/i18n/localized";
import { formatTransferWindow } from "@/lib/transfers/terms";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale());
  return { title: dict["transfers.title"] };
}

/**
 * Transfers into the kingdom: open or closed (the admins' switch). While
 * open it shows the game's terms for the window (each part only when set)
 * and anything else the admins wrote (rich text); whom to ask shows either way, with a
 * Discord button: the transfers' own server ("Join the transfer Discord"),
 * else the kingdom's ("Join our Discord", as on Home), else none.
 * No guided tour yet: the texts and terms are placeholders until the admins
 * fill them in.
 */
export default async function TransfersPage() {
  const locale = await rootLocale();
  const [dict, settings] = await Promise.all([getDictionary(locale), getSettings()]);
  const open = settings.transfersOpen;
  const terms = settings.transferTerms;
  const info = open ? pick(settings.transferInfo, locale) : "";
  const contact = pick(settings.transferContact, locale);
  // The transfers' own server, else the kingdom's; each button says which one it opens.
  const discord = settings.transferDiscordUrl
    ? { url: settings.transferDiscordUrl, label: dict["transfers.joinDiscord"] }
    : settings.discordInviteUrl
      ? { url: settings.discordInviteUrl, label: dict["home.joinDiscord"] }
      : null;
  const powers = [
    { key: "transfers.regularKingdom" as const, value: terms.powerRegular },
    { key: "transfers.leadingKingdom" as const, value: terms.powerLeading },
  ].filter((power) => power.value !== null);
  const showTerms = open && (terms.windowStart || terms.kingdomFrom !== null || powers.length > 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon="🧳" title={dict["transfers.title"]} subtitle={dict["transfers.subtitle"]} />
      <section className="card p-6 md:p-8" aria-labelledby="transfers-status">
        <p className={clsx("chip", open ? "bg-success-soft text-success" : "bg-card-soft text-ink-muted")}>
          {open ? `● ${dict["transfers.open"]}` : dict["transfers.closed"]}
        </p>
        <h2 id="transfers-status" className="mt-3 text-xl font-black text-ink">
          {open ? dict["transfers.statusOpen"] : dict["transfers.statusClosed"]}
        </h2>
        {showTerms && (
          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {terms.windowStart && terms.windowEnd && (
              <Term icon="📅" label={dict["transfers.window"]} wide>
                <TransferWindow start={terms.windowStart} end={terms.windowEnd} locale={locale} />
              </Term>
            )}
            {terms.kingdomFrom !== null && terms.kingdomTo !== null && (
              <Term icon="🗺️" label={dict["transfers.kingdoms"]}>
                {format(dict["transfers.kingdomRange"], { from: terms.kingdomFrom, to: terms.kingdomTo })}
              </Term>
            )}
            {powers.length > 0 && (
              <Term icon="⚡" label={dict["transfers.powerCap"]}>
                <ul className="space-y-0.5">
                  {powers.map((power) => (
                    <li key={power.key} className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-sm font-bold text-ink-muted">{dict[power.key]}</span>
                      {/* No dir="ltr": in Arabic the number comes with a word ("150 مليون"). */}
                      <bdi className="tabular">{formatPower(power.value!, locale)}</bdi>
                    </li>
                  ))}
                </ul>
              </Term>
            )}
          </dl>
        )}
        {info && <RichText html={info} className="mt-4" />}
      </section>
      {(contact || discord) && (
        <section className="card mt-5 p-6 md:p-8" aria-labelledby="transfers-contact">
          <h2 id="transfers-contact" className="flex items-center gap-2 text-xl font-black text-ink">
            <MessageCircle className="size-5 shrink-0 text-primary" aria-hidden />
            {dict["transfers.contactTitle"]}
          </h2>
          {contact && <RichText html={contact} className="mt-2" />}
          {discord && (
            <a href={discord.url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4">
              {discord.label} <ExternalLink className="size-4 shrink-0" aria-hidden />
            </a>
          )}
        </section>
      )}
    </div>
  );
}

/** Start – end, each end isolated so an Arabic page still reads from the start. */
function TransferWindow({ start, end, locale }: { start: string; end: string; locale: string }) {
  const [from, to] = formatTransferWindow(start, end, locale);
  return (
    <>
      <bdi>{from}</bdi> – <bdi>{to}</bdi> UTC
    </>
  );
}

function Term({ icon, label, wide, children }: { icon: string; label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={clsx("min-w-0 rounded-xl bg-card-soft px-4 py-3", wide && "sm:col-span-2")}>
      <dt className="flex items-center gap-1.5 text-xs font-bold text-ink-faint">
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 font-extrabold wrap-break-word text-ink">{children}</dd>
    </div>
  );
}
