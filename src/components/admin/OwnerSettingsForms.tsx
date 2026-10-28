"use client";

import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useActionState, useState } from "react";
import { type ActionState, IDLE_STATE } from "@/lib/admin/action-state";
import type { OwnerLanguage } from "@/lib/admin/settings-data";
import { type MoveDirection, moveInList } from "@/lib/admin/kvk-forms";
import { describeLanguageChanges, hasLanguageChanges, languageChanges, languageFormValues, parseLanguageForm } from "@/lib/admin/languages";
import { saveFeedbackDefaults, saveLanguages, savePasswordRules, saveTranslationPause } from "@/lib/admin/settings-actions";
import type { NumberSchema } from "@/lib/config/numbers";
import { DEFAULT_PASSWORD_RULES, PASSWORD_RULES, type PasswordRuleKey, type PasswordRules } from "@/lib/kvk/password-rules";
import { DEFAULT_FEEDBACK_DEFAULTS, FEEDBACK_DEFAULTS, type FeedbackDefaultKey, type FeedbackDefaults } from "@/lib/retro/form-defaults";
import { Field, Notice } from "./ui";

/** The smaller forms of the owner's settings page (the Rally Sync capacity has its own, CapacityForm). */

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

export function LanguageList({ languages, texts, locale }: { languages: OwnerLanguage[]; texts: number; locale: string }) {
  const [draft, setDraft] = useState(languages);
  const [saved, setSaved] = useState(languages);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await saveLanguages(previous, formData);
    const sent = parseLanguageForm(
      formData,
      languages.map((language) => language.code),
    );
    if (result.status === "saved" && sent.ok) setSaved(sent.value.map((row) => ({ ...languages.find((language) => language.code === row.code)!, shown: row.shown })));
    return result;
  }, IDLE_STATE);

  const changes = languageChanges(saved, draft);
  const dirty = hasLanguageChanges(changes);
  const values = languageFormValues(draft);
  const move = (code: string, direction: MoveDirection) =>
    setDraft((list) => moveInList(list.map((language) => language.code), code, direction)?.map((next) => list.find((language) => language.code === next)!) ?? list);
  const toggle = (code: string) => setDraft((list) => list.map((language) => (language.code === code ? { ...language, shown: !language.shown } : language)));

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order" value={values.order} />
      <input type="hidden" name="hidden" value={values.hidden} />
      <ul className="divide-y divide-line">
        {draft.map((language, index) => {
          const before = saved.findIndex((candidate) => candidate.code === language.code);
          const changed = before !== index || saved[before]?.shown !== language.shown;
          return (
            <li key={language.code} className="flex items-center gap-3 py-3">
              <div className="flex shrink-0 flex-col items-center gap-2">
                <button type="button" className="btn-ghost btn-sm px-2 py-1" onClick={() => move(language.code, "up")} disabled={pending || index === 0} aria-label={`Move ${language.name} up`}>
                  <ChevronUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm px-2 py-1"
                  onClick={() => move(language.code, "down")}
                  disabled={pending || index === draft.length - 1}
                  aria-label={`Move ${language.name} down`}
                >
                  <ChevronDown className="size-4" aria-hidden />
                </button>
              </div>
              <div className={clsx("min-w-0 flex-1 space-y-0.5", !language.shown && "opacity-70")}>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-ink">
                  <span>
                    <span aria-hidden>{language.flag}</span> <span dir="auto">{language.nativeName}</span>
                  </span>
                  <span className={clsx("chip", language.shown ? "bg-success-soft text-success" : "bg-card-soft text-ink-muted")}>{language.shown ? "Shown" : "Hidden"}</span>
                  {changed && <span className="chip bg-gold-soft text-gold-ink">Not saved</span>}
                </p>
                <p className="text-xs text-ink-muted">
                  {language.name}, <span dir="ltr">{language.code}</span> ·{" "}
                  {language.code === "en"
                    ? "the source, always shown"
                    : language.missing === 0
                      ? "everything translated"
                      : `${language.missing.toLocaleString("en")} of ${texts.toLocaleString("en")} texts not translated`}
                </p>
              </div>
              {language.code !== "en" && (
                <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => toggle(language.code)} disabled={pending}>
                  {language.shown ? "Hide" : "Show"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {dirty && <p className="text-sm font-bold text-ink">Not saved yet: {describeLanguageChanges(changes)}. Players see no change until you save.</p>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-tour="settings-languages-save">
        <button type="submit" className="btn-primary btn-sm" disabled={pending || !dirty}>
          Save
        </button>
        {dirty && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setDraft(saved)} disabled={pending}>
            Undo changes
          </button>
        )}
      </div>
      <Notice state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Machine translation
// ---------------------------------------------------------------------------

export function TranslationPauseForm({ paused, locale }: { paused: boolean; locale: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTranslationPause, IDLE_STATE);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="paused" value={paused ? "0" : "1"} />
      <button type="submit" className={paused ? "btn-primary btn-sm" : "btn-ghost btn-sm"} disabled={pending}>
        {paused ? "Resume machine translation" : "Pause machine translation"}
      </button>
      <Notice state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Number settings: the wrong-password rules and the feedback defaults
// ---------------------------------------------------------------------------

function NumberSettings<K extends string>({
  schema,
  labels,
  initial,
  defaults,
  action,
  locale,
  summary,
  tour,
}: {
  schema: NumberSchema<K>;
  labels: Record<K, { label: string; hint?: string }>;
  initial: Record<K, number>;
  defaults: Record<K, number>;
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  locale: string;
  summary: (values: Record<K, number>) => string;
  tour: string;
}) {
  const [values, setValues] = useState(initial);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, IDLE_STATE);
  const keys = Object.keys(schema) as K[];
  const errors = state.errors ?? {};
  const isDefault = keys.every((key) => values[key] === defaults[key]);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {keys.map((key) => (
          <Field key={key} label={labels[key].label} htmlFor={`setting-${key}`} hint={labels[key].hint ?? `${schema[key].min} to ${schema[key].max}.`} error={errors[key]}>
            <input
              id={`setting-${key}`}
              name={key}
              type="number"
              inputMode="numeric"
              min={schema[key].min}
              max={schema[key].max}
              className="input"
              value={Number.isNaN(values[key]) ? "" : String(values[key])}
              onChange={(event) => setValues((v) => ({ ...v, [key]: event.target.value === "" ? NaN : Number(event.target.value) }))}
              required
            />
          </Field>
        ))}
      </div>
      <p className="rounded-xl bg-card-soft px-3 py-2 text-sm text-ink-muted">{summary(values)}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-tour={tour}>
        <button type="submit" className="btn-primary btn-sm" disabled={pending}>
          Save
        </button>
        {!isDefault && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setValues(defaults)}>
            Use the defaults
          </button>
        )}
      </div>
      <Notice state={state} />
    </form>
  );
}

const plural = (n: number, one: string, many: string) => (Number.isNaN(n) ? `… ${many}` : `${n} ${n === 1 ? one : many}`);

function duration(minutes: number): string {
  if (Number.isNaN(minutes)) return "…";
  if (minutes < 60) return plural(minutes, "minute", "minutes");
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${plural(hours, "hour", "hours")} ${plural(rest, "minute", "minutes")}` : plural(hours, "hour", "hours");
}

const PASSWORD_LABELS: Record<PasswordRuleKey, { label: string; hint?: string }> = {
  tries: { label: "Wrong tries before a lockout" },
  windowMinutes: { label: "… within (minutes)" },
  firstLockMinutes: { label: "First lockout (minutes)" },
  maxLockHours: { label: "Longest lockout (hours)" },
  alertTries: { label: "Alert the council after (wrong tries in an hour)", hint: "From every address together; nobody is locked out by this." },
};

export function PasswordRulesForm({ initial, locale }: { initial: PasswordRules; locale: string }) {
  return (
    <NumberSettings
      schema={PASSWORD_RULES}
      labels={PASSWORD_LABELS}
      initial={initial}
      defaults={DEFAULT_PASSWORD_RULES}
      action={savePasswordRules}
      locale={locale}
      tour="settings-passwords-save"
      summary={(v) =>
        `${plural(v.tries, "wrong try", "wrong tries")} within ${duration(v.windowMinutes)} lock that address for ${duration(v.firstLockMinutes)}; every further lockout lasts twice as long, up to ${plural(v.maxLockHours, "hour", "hours")}. ${plural(v.alertTries, "wrong try", "wrong tries")} in an hour from everyone together alert the council.`
      }
    />
  );
}

const FEEDBACK_LABELS: Record<FeedbackDefaultKey, { label: string; hint?: string }> = {
  retentionDays: { label: "Keep answers for (days after the battle)" },
  maxResponses: { label: "Most answers per battle" },
};

export function FeedbackDefaultsForm({ initial, locale }: { initial: FeedbackDefaults; locale: string }) {
  return (
    <NumberSettings
      schema={FEEDBACK_DEFAULTS}
      labels={FEEDBACK_LABELS}
      initial={initial}
      defaults={DEFAULT_FEEDBACK_DEFAULTS}
      action={saveFeedbackDefaults}
      locale={locale}
      tour="settings-feedback-save"
      summary={(v) =>
        `A new feedback form keeps its answers for ${plural(v.retentionDays, "day", "days")} after the battle and takes at most ${plural(v.maxResponses, "answer", "answers")}. Moderators can still change both on each form; forms already created keep their own.`
      }
    />
  );
}
