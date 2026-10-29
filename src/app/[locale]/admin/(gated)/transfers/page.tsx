import type { Metadata } from "next";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { ContentTranslationMode } from "@/components/admin/ContentTranslationMode";
import { TransfersForm } from "@/components/admin/KingdomForms";
import { LanguagePicker } from "@/components/admin/LanguagePicker";
import { EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getTransfersForEditing } from "@/lib/admin/kingdom-data";
import { TRANSFER_CONTACT_MAX, TRANSFER_INFO_MAX } from "@/lib/admin/site-forms";
import { parseEditLang } from "@/lib/admin/translation";
import { htmlToMarkdown } from "@/lib/content/html-to-markdown";
import { adminPath } from "@/lib/auth/paths";
import { canManageUsers } from "@/lib/auth/roles";
import { requireEditor } from "@/lib/auth/server";
import { SEED_SETTINGS } from "@/content/seed/settings";
import { getLanguages } from "@/lib/data";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Discord & transfers" };

type Props = PageProps<"/[locale]/admin/transfers">;

export default async function AdminTransfersPage({ searchParams }: Props) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Transfers locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function Transfers({ locale, searchParams }: { locale: string; searchParams: Props["searchParams"] }) {
  const user = await requireEditor(locale);
  if (!user) return null;
  if (!canManageUsers(user.role)) return <EmptyRow>Only administrators change the kingdom&apos;s Discord and transfers.</EmptyRow>;
  const [query, transfers, languages] = await Promise.all([
    searchParams,
    getTransfersForEditing({ open: SEED_SETTINGS.transfersOpen, info: SEED_SETTINGS.transferInfo, contact: SEED_SETTINGS.transferContact }),
    getLanguages(),
  ]);
  if (!transfers) return <EmptyRow>The transfer settings could not be read from the database.</EmptyRow>;
  const enabled = languages.filter((l) => l.enabled);
  const lang = parseEditLang(typeof query.lang === "string" ? query.lang : "en", enabled.map((l) => l.code));
  const langLabel = enabled.find((l) => l.code === lang)?.nativeName ?? lang;

  return (
    <div className="space-y-6">
      <SectionTitle
        icon="🧳"
        title="Discord & transfers"
        action={
          <Link href={`/${locale}/transfers`} className="btn-ghost btn-sm" target="_blank" rel="noopener" data-tour="transfers-view">
            View the page ↗
          </Link>
        }
      />
      <p className="text-sm font-semibold text-ink-muted">
        The kingdom&apos;s Discord invite, and whether the kingdom takes transfers (shown next to the alliances on Home and on its own page). Administrators only.
        You write in English; the other languages follow within a minute of saving.
      </p>
      <div data-tour="transfers-language">
        <LanguagePicker languages={enabled} current={lang} href={adminPath(locale, "/transfers")} />
      </div>
      {lang === "en" ? (
        <TransfersForm
          transfers={transfers}
          infoMarkdown={htmlToMarkdown(pick(transfers.info.value, "en"))}
          contactMarkdown={htmlToMarkdown(pick(transfers.contact.value, "en"))}
          locale={locale}
        />
      ) : (
        <ContentTranslationMode
          key={lang}
          table="site_settings"
          id="transfer_info"
          locale={locale}
          lang={lang}
          langLabel={langLabel}
          title="Transfer texts"
          fields={[
            {
              id: "transfer_info",
              column: "value",
              label: "Anything else (while open)",
              english: htmlToMarkdown(pick(transfers.info.value, "en")),
              value: transfers.info.value[lang] ? htmlToMarkdown(transfers.info.value[lang]) : "",
              pending: transfers.info.pending,
              markdown: true,
              maxLength: TRANSFER_INFO_MAX,
            },
            {
              id: "transfer_contact",
              column: "value",
              label: "Whom to ask",
              english: htmlToMarkdown(pick(transfers.contact.value, "en")),
              value: transfers.contact.value[lang] ? htmlToMarkdown(transfers.contact.value[lang]) : "",
              pending: transfers.contact.pending,
              markdown: true,
              maxLength: TRANSFER_CONTACT_MAX,
            },
          ]}
        />
      )}
    </div>
  );
}
