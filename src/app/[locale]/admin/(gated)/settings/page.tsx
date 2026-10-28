import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { FeedbackDefaultsForm, PasswordRulesForm, TranslationPauseForm } from "@/components/admin/OwnerSettingsForms";
import { SettingsTabPage } from "@/components/admin/SettingsFrame";
import { AdminSection } from "@/components/admin/ui";
import { utcLabel } from "@/lib/admin/format";
import { getGeneralSettings, type MachineTranslation, type OwnerEntry } from "@/lib/admin/settings-data";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <SettingsTabPage locale={locale} tab="general" load={getGeneralSettings}>
        {(settings) => (
          <>
            <AdminSection id="owner" title="Owner" tour="settings-owner" hint="Set once, when the site is set up (SITE_OWNER in Vercel, SETUP.md step 0). Nothing in the site can change it.">
              <OwnerLine owners={settings.owners} />
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
          </>
        )}
      </SettingsTabPage>
    </Suspense>
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
