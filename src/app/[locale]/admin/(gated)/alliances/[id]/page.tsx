import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { ContentTranslationMode } from "@/components/admin/ContentTranslationMode";
import { AllianceProfileForm } from "@/components/admin/KingdomForms";
import { LanguagePicker } from "@/components/admin/LanguagePicker";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { isUuid } from "@/lib/admin/forms";
import { getAllianceProfile } from "@/lib/admin/kingdom-data";
import { ALLIANCE_DESCRIPTION_MAX, ALLIANCE_REQUIREMENTS_MAX } from "@/lib/admin/site-forms";
import { parseEditLang } from "@/lib/admin/translation";
import { alliancePath } from "@/lib/alliances/pages";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { getLanguages } from "@/lib/data";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Edit alliance page" };

/** Real ids are rendered on request; Cache Components wants one known param. */
export function generateStaticParams() {
  return [{ id: "new" }];
}

type EditorProps = PageProps<"/[locale]/admin/alliances/[id]">;

export default async function AdminAllianceEditorPage({ params, searchParams }: EditorProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Editor locale={locale} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ locale, params, searchParams }: { locale: string; params: EditorProps["params"]; searchParams: EditorProps["searchParams"] }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!(await requireEditor(locale))) return null;
  if (!isUuid(id)) notFound();
  const [alliance, languages] = await Promise.all([getAllianceProfile(id), getLanguages()]);
  if (!alliance) notFound();
  const enabled = languages.filter((l) => l.enabled);
  const lang = parseEditLang(typeof query.lang === "string" ? query.lang : "en", enabled.map((l) => l.code));
  const langLabel = enabled.find((l) => l.code === lang)?.nativeName ?? lang;

  return (
    <div className="space-y-6">
      <SectionTitle
        icon="🛡️"
        title={`[${alliance.tag}] ${alliance.name}`}
        action={
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            <Link href={adminPath(locale, "/alliances")} className="btn-ghost btn-sm">
              ← Back to alliances
            </Link>
            {alliance.published && (
              <Link href={`/${locale}${alliancePath(alliance.tag)}`} className="btn-ghost btn-sm" target="_blank" rel="noopener" data-tour="alliance-view">
                View the page ↗
              </Link>
            )}
          </div>
        }
      />
      <div data-tour="alliance-language">
        <LanguagePicker languages={enabled} current={lang} href={adminPath(locale, `/alliances/${alliance.id}`)} />
      </div>
      {lang === "en" ? (
        <AllianceProfileForm alliance={alliance} locale={locale} />
      ) : (
        <ContentTranslationMode
          key={lang}
          table="alliances"
          id={alliance.id}
          locale={locale}
          lang={lang}
          langLabel={langLabel}
          title="Alliance page"
          fields={[
            {
              column: "description",
              label: "About the alliance",
              english: pick(alliance.description, "en"),
              value: alliance.description[lang] ?? "",
              pending: alliance.pending.includes("description"),
              multiline: true,
              maxLength: ALLIANCE_DESCRIPTION_MAX,
            },
            {
              column: "requirements",
              label: "Requirements",
              english: pick(alliance.requirements, "en"),
              value: alliance.requirements[lang] ?? "",
              pending: alliance.pending.includes("requirements"),
              multiline: true,
              maxLength: ALLIANCE_REQUIREMENTS_MAX,
            },
          ]}
        />
      )}
    </div>
  );
}
