import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { AllianceSettings } from "@/components/admin/AllianceSettings";
import { CapacityForm } from "@/components/admin/CapacityForm";
import { FeedbackDefaultsForm, LanguageList, PasswordRulesForm, TranslationPauseForm } from "@/components/admin/OwnerSettingsForms";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { utcLabel } from "@/lib/admin/format";
import { DAILY_SYNC_UTC } from "@/lib/alliances/sync-plan";
import { getOwnerSettings, type MachineTranslation, type OwnerEntry } from "@/lib/admin/settings-data";
import { requireEditor } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Settings locale={locale} />
    </Suspense>
  );
}

const SECTIONS = [
  { id: "owner", label: "Owner" },
  { id: "rally-sync", label: "Rally Sync" },
  { id: "alliances", label: "Alliances" },
  { id: "languages", label: "Languages" },
  { id: "translation", label: "Machine translation" },
  { id: "passwords", label: "Wrong passwords" },
  { id: "feedback", label: "Feedback forms" },
];

async function Settings({ locale }: { locale: string }) {
  const user = await requireEditor(locale);
  if (!user) return null;
  if (!user.isOwner) return <EmptyRow>Only the owner can open the settings.</EmptyRow>;
  const settings = await getOwnerSettings();
  if (!settings) return <EmptyRow>The settings could not be loaded. Reload the page.</EmptyRow>;

  return (
    <div className="space-y-6">
      <SectionTitle icon="⚙️" title="Settings" />
      <p className="text-sm font-semibold text-ink-muted">
        Only you, the owner, see this page and its link. Changes apply at once, and each one appears under Recent changes on the Overview.
      </p>
      <nav className="flex flex-wrap gap-x-2 gap-y-3" aria-label="Settings sections">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="btn-ghost btn-sm">
            {section.label}
          </a>
        ))}
      </nav>

      <AdminSection id="owner" title="Owner" tour="settings-owner" hint="Set once, when the site is set up (SITE_OWNER in Vercel, SETUP.md step 0). Nothing in the site can change it.">
        <OwnerLine owners={settings.owners} />
      </AdminSection>

      <AdminSection
        id="rally-sync"
        title="Rally Sync capacity"
        tour="settings-capacity"
        hint="How many rooms of each kind moderators can open at once, and how many leaders and browsers each room takes. The three kinds share one limit, so the total is checked with every change."
      >
        <CapacityForm initial={settings.rally.capacity} usage={settings.rally.usage} available={settings.rally.available} locale={locale} />
      </AdminSection>

      <AdminSection
        id="alliances"
        title="Alliances"
        tour="settings-alliances"
        hint={`The alliances on Home, strongest first. Each is linked to its alliance in MightPulse, so its tag, name, power, leader and members follow the game every day at ${DAILY_SYNC_UTC} UTC, even after a rename. When MightPulse is down, type the numbers by hand; the next sync replaces them. Description, requirements and Discord link stay as they are.`}
      >
        <AllianceSettings settings={settings.alliances} locale={locale} />
      </AdminSection>

      <AdminSection
        id="languages"
        title="Languages"
        tour="settings-languages"
        hint="The order of the language menu, and which languages players can pick. A hidden language leaves the menu, its links open the same page in the player's other language and nothing is translated into it, so it costs nothing; showing it again brings it back as it was. Arrange the list, then Save."
      >
        {settings.languages.available ? (
          <LanguageList languages={settings.languages.languages} texts={settings.languages.texts} locale={locale} />
        ) : (
          <EmptyRow>The languages could not be read from the database.</EmptyRow>
        )}
        <p className="mt-3 text-xs text-ink-faint">
          Texts not translated yet show in English. A new language is added in the code, not here, so it comes with its game words, writing rules and a
          reviewed translation (SETUP.md, “Adding a language”). After a save the menu changes at once; players who already have the site open see it after a reload.
        </p>
      </AdminSection>

      <AdminSection
        id="translation"
        title="Machine translation"
        tour="settings-translation"
        hint="A brake on the AI bill. While paused, nothing is sent to the AI: edited texts show in English in the other languages, and the feedback buttons Translate answers and Translate and analyse wait."
      >
        <TranslationStatus translation={settings.translation} />
        <TranslationPauseForm paused={settings.translation.paused} locale={locale} />
      </AdminSection>

      <AdminSection
        id="passwords"
        title="Wrong passwords"
        tour="settings-passwords"
        hint="For the battle plan, the leader and checklist pages and the Rally Sync rooms. Guessing is slowed down per address, and the council is alerted when many guesses come in at once; a player is never locked out because of someone else."
      >
        <PasswordRulesForm initial={settings.passwordRules} locale={locale} />
      </AdminSection>

      <AdminSection id="feedback" title="Feedback forms" tour="settings-feedback" hint="What a new battle feedback form starts with. Moderators can still change it on each form.">
        <FeedbackDefaultsForm initial={settings.feedbackDefaults} locale={locale} />
      </AdminSection>
    </div>
  );
}

const OWNER_KINDS: Record<OwnerEntry["kind"], string> = { discord_id: "Discord user id ending in", discord_handle: "Discord username", email: "E-mail (development only)" };

function OwnerLine({ owners }: { owners: OwnerEntry[] }) {
  if (owners.length === 0) return <p className="text-sm font-bold text-danger">SITE_OWNER is not set.</p>;
  return (
    <ul className="space-y-2">
      {owners.map((owner) => (
        <li key={`${owner.kind}:${owner.shown}`} className="text-sm">
          {/* The id is what signs the owner in; the signed-in owner's own account is named by its handle instead of the number. */}
          <span className="font-bold text-ink">{owner.kind === "discord_id" && owner.handle ? "Discord account" : OWNER_KINDS[owner.kind]}</span>{" "}
          <span className="font-semibold break-all text-ink-muted" dir="ltr">
            {owner.kind === "discord_id" && owner.handle ? `@${owner.handle}` : owner.kind === "discord_handle" ? `@${owner.shown}` : owner.shown}
          </span>
          {owner.you && <span className="chip ms-2 bg-success-soft text-success">You</span>}
          {owner.kind === "discord_id" && owner.handle && (
            <p className="mt-1 text-xs text-ink-faint">Set by its Discord user id, so a new username keeps it the owner.</p>
          )}
          {owner.kind === "discord_handle" && (
            <p className="mt-1 text-xs font-bold text-danger">
              Production needs the Discord user id here: a username can be renamed and then taken by someone else, and the next deploy fails until it is
              switched. Discord → Settings → Advanced → Developer Mode, then Copy User ID on your profile; paste it into SITE_OWNER in Vercel and redeploy.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function TranslationStatus({ translation }: { translation: MachineTranslation }) {
  const [label, tone] = !translation.configured
    ? ["Off: no ANTHROPIC_API_KEY or GEMINI_API_KEY is set, so nothing is translated whatever this switch says.", "text-ink-muted"]
    : translation.paused
      ? [`Paused${translation.since ? ` since ${utcLabel(translation.since)} UTC` : ""}.`, "text-danger"]
      : [`Running (${translation.label}).`, "text-success"];
  return <p className={`mb-3 text-sm font-bold ${tone}`}>{label}</p>;
}
