"use client";

import clsx from "clsx";
import { useState } from "react";
import type { AdminAllianceProfile, AdminTransfers } from "@/lib/admin/kingdom-data";
import { toUtcInputValue } from "@/lib/admin/forms";
import { saveAllianceProfile, saveTransfers } from "@/lib/admin/kingdom-actions";
import { ALLIANCE_DESCRIPTION_MAX, ALLIANCE_REQUIREMENTS_MAX, TRANSFER_CONTACT_MAX, TRANSFER_INFO_MAX } from "@/lib/admin/site-forms";
import { pick } from "@/lib/i18n/localized";
import { DateTimeField } from "./DateTimeField";
import { MarkdownEditor } from "./MarkdownEditor";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";
import { useEditorForm } from "./useEditorForm";

/** What an alliance's page says about it, in English (its numbers come from MightPulse). */
export function AllianceProfileForm({ alliance, locale }: { alliance: AdminAllianceProfile; locale: string }) {
  const { state, action, submit, errors } = useEditorForm(saveAllianceProfile);
  return (
    <form action={action} onSubmit={submit} className="card space-y-5 p-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={alliance.id} />

      <Field
        label="About the alliance (English)"
        htmlFor="description"
        error={errors.description}
        tour="alliance-description"
        hint="A few lines from its leaders: what kind of alliance it is, what it plays for, when it is active. Line breaks are kept."
      >
        <textarea id="description" name="description" className="input min-h-32" defaultValue={pick(alliance.description, "en")} maxLength={ALLIANCE_DESCRIPTION_MAX} dir="ltr" />
      </Field>

      <Field label="Requirements (English)" htmlFor="requirements" error={errors.requirements} tour="alliance-requirements" hint="What it asks of new members, such as a power or town-centre level.">
        <textarea id="requirements" name="requirements" className="input min-h-20" defaultValue={pick(alliance.requirements, "en")} maxLength={ALLIANCE_REQUIREMENTS_MAX} dir="ltr" />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Languages" htmlFor="languages" error={errors.languages} hint="The languages its chat uses, such as “EN / DE”. Not translated.">
          <input id="languages" name="languages" className="input" defaultValue={alliance.languages ?? ""} maxLength={40} dir="ltr" />
        </Field>
        <Field
          label="Discord invite (optional)"
          htmlFor="discordUrl"
          error={errors.discordUrl}
          tour="alliance-discord-link"
          hint="Empty: no Discord button. Use a link that doesn't expire (in Discord: Invite people → Edit invite link → Never)."
        >
          <input id="discordUrl" name="discordUrl" className="input" defaultValue={alliance.discordUrl ?? ""} placeholder="https://discord.gg/…" dir="ltr" inputMode="url" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3" data-tour="alliance-save">
        <SubmitButton>Save alliance page</SubmitButton>
        <Notice state={state} />
      </div>
    </form>
  );
}

/** A stored power → the millions the form shows (97500000 → "97.5"). */
function millions(power: number | null): string {
  return power === null ? "" : String(power / 1_000_000);
}

/**
 * The kingdom's Discord, and the transfer section in English: the switch, the
 * game's terms for the window, anything else players should know while open,
 * whom to ask, and its own invite.
 */
export function TransfersForm({
  transfers,
  infoMarkdown,
  contactMarkdown,
  locale,
}: {
  transfers: AdminTransfers;
  /** The two texts in English as Markdown (stored as HTML). */
  infoMarkdown: string;
  contactMarkdown: string;
  locale: string;
}) {
  const { state, action, submit, errors } = useEditorForm(saveTransfers);
  const [open, setOpen] = useState(transfers.open);
  return (
    <form action={action} onSubmit={submit} className="card space-y-5 p-5">
      <input type="hidden" name="locale" value={locale} />

      <Field
        label="Kingdom Discord invite (optional)"
        htmlFor="discordUrl"
        error={errors.discordUrl}
        tour="kingdom-discord"
        hint="The server for all of 1241: a “Join our Discord” button on Home and a link at the foot of every page. Empty: neither shows. Use an invite that never expires."
      >
        <input id="discordUrl" name="discordUrl" className="input" defaultValue={transfers.discordUrl ?? ""} placeholder="https://discord.gg/…" dir="ltr" inputMode="url" />
      </Field>

      <h3 className="border-t border-line pt-5 text-base font-black text-ink">Transfers</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Transfers" data-tour="transfers-switch">
        {[
          { value: false, title: "Closed", text: "Players see that transfers are closed, and whom to ask." },
          { value: true, title: "Open", text: "Players see that transfers are open with the terms below, and a badge on Home." },
        ].map((option) => (
          <label
            key={option.title}
            className={clsx("flex cursor-pointer gap-3 rounded-xl border-2 bg-card p-3", open === option.value ? "border-primary" : "border-line hover:border-primary/50")}
          >
            <input type="radio" name="open" value={option.value ? "on" : ""} checked={open === option.value} onChange={() => setOpen(option.value)} className="mt-1 size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block font-extrabold text-ink">{option.title}</span>
              <span className="block text-xs text-ink-muted">{option.text}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="space-y-4" data-tour="transfers-terms">
        <p className="text-sm text-ink-muted">
          The game&apos;s numbers for this window, as its Transfer Manager shows them. Players see them while transfers are open; leave out what you don&apos;t know yet.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Transfer group: first kingdom" htmlFor="kingdomFrom" error={errors.kingdomFrom} hint="Such as 1201. Both empty: not shown.">
            <input id="kingdomFrom" name="kingdomFrom" type="number" min={1} max={99999} inputMode="numeric" className="input" defaultValue={transfers.terms.kingdomFrom ?? ""} dir="ltr" />
          </Field>
          <Field label="Transfer group: last kingdom" htmlFor="kingdomTo" error={errors.kingdomTo} hint="Such as 1260.">
            <input id="kingdomTo" name="kingdomTo" type="number" min={1} max={99999} inputMode="numeric" className="input" defaultValue={transfers.terms.kingdomTo ?? ""} dir="ltr" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateTimeField
            id="windowStart"
            name="windowStart"
            label="Window opens (UTC)"
            defaultValue={toUtcInputValue(transfers.terms.windowStart)}
            error={errors.windowStart}
            hint="When the game opens transfers. Both empty: not shown."
            allowPast
          />
          <DateTimeField
            id="windowEnd"
            name="windowEnd"
            label="Window closes (UTC)"
            defaultValue={toUtcInputValue(transfers.terms.windowEnd)}
            error={errors.windowEnd}
            hint="When the game closes them again."
            allowPast
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Power cap, regular kingdom (millions)"
            htmlFor="powerRegular"
            error={errors.powerRegular}
            hint="The most Transfer Power a governor may have to move here without a special invite, such as 150. Empty: not shown."
          >
            <input id="powerRegular" name="powerRegular" inputMode="decimal" className="input" defaultValue={millions(transfers.terms.powerRegular)} placeholder="150" dir="ltr" />
          </Field>
          <Field
            label="Power cap, leading kingdom (millions)"
            htmlFor="powerLeading"
            error={errors.powerLeading}
            hint="The same while 1241 counts as a leading kingdom (the lower cap), such as 97.5. Empty: not shown."
          >
            <input id="powerLeading" name="powerLeading" inputMode="decimal" className="input" defaultValue={millions(transfers.terms.powerLeading)} placeholder="97.5" dir="ltr" />
          </Field>
        </div>
      </div>

      <Field
        label="While open: anything else players should know (English, optional)"
        htmlFor="info"
        error={errors.info}
        tour="transfers-info"
        hint="Such as how many slots there are or what you expect of newcomers; the kingdoms, times and power caps above show on their own. Use the buttons, or Markdown: **bold**, *italics*, ## heading, - list, > a gold box, > [!DANGER] a red one. Preview shows it as players will see it."
      >
        <MarkdownEditor id="info" name="info" defaultValue={infoMarkdown} maxLength={TRANSFER_INFO_MAX} className="min-h-32" />
      </Field>

      <Field
        label="Whom to ask about a transfer (English, optional)"
        htmlFor="contact"
        error={errors.contact}
        tour="transfers-contact"
        hint="Who answers players who want to move here: a name in bold with their Discord handle, or a channel. Always on the transfers page, open or closed, above the Discord button. Use the buttons, or Markdown."
      >
        <MarkdownEditor id="contact" name="contact" defaultValue={contactMarkdown} maxLength={TRANSFER_CONTACT_MAX} className="min-h-20" />
      </Field>

      <Field
        label="Discord invite for transfers (optional)"
        htmlFor="transferDiscordUrl"
        error={errors.transferDiscordUrl}
        tour="transfers-discord"
        hint="A “Join the transfer Discord” button under whom to ask, open or closed: a separate server for players who want to move here, or a transfers channel. Empty: the kingdom Discord above, as “Join our Discord”; with neither, no button."
      >
        <input
          id="transferDiscordUrl"
          name="transferDiscordUrl"
          className="input"
          defaultValue={transfers.transferDiscordUrl ?? ""}
          placeholder="https://discord.gg/…"
          dir="ltr"
          inputMode="url"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3" data-tour="transfers-save">
        <SubmitButton>Save</SubmitButton>
        <Notice state={state} />
      </div>
    </form>
  );
}
