import { configFromForm, configProblem, INTRO_MAX, MAX_RESPONSES_LIMIT, RETENTION_RANGE, type RetroConfig, TITLE_MAX } from "@/lib/retro/questions";
import { boolField, type FormResult, intField, textField, utcDateTimeField } from "./forms";

/** Parser for the retrospective settings in the plan editor (pure, unit-tested). */

export interface RetroSettingsInput {
  open: boolean;
  title: string;
  /** Markdown written by the admin; rendered to sanitised HTML on save. */
  introSource: string;
  closesAt: string | null;
  maxResponses: number;
  retentionDays: number;
  config: RetroConfig;
}

export function parseRetroSettingsForm(fd: FormData): FormResult<RetroSettingsInput> {
  const errors: Record<string, string> = {};

  const title = textField(fd, "title");
  if (!title) errors.title = "Give the feedback form a title (players see it above the questions).";
  else if (title.length > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`;

  const introSource = textField(fd, "introSource");
  if (introSource.length > INTRO_MAX) errors.introSource = `Keep the introduction under ${INTRO_MAX} characters.`;

  const closesAt = utcDateTimeField(fd, "closesAt");
  if (closesAt === undefined) errors.closesAt = "Enter the date and time as the form shows them (UTC), or clear the field.";

  const maxResponses = intField(fd, "maxResponses", 1, MAX_RESPONSES_LIMIT);
  if (maxResponses === null) errors.maxResponses = `A whole number from 1 to ${MAX_RESPONSES_LIMIT}.`;

  const retentionDays = intField(fd, "retentionDays", RETENTION_RANGE.min, RETENTION_RANGE.max);
  if (retentionDays === null) errors.retentionDays = `A whole number of days from ${RETENTION_RANGE.min} to ${RETENTION_RANGE.max}.`;

  const config = configFromForm(fd);
  const problem = configProblem(config);
  if (problem) errors.config = problem;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      open: boolField(fd, "open"),
      title,
      introSource,
      closesAt: closesAt ?? null,
      maxResponses: maxResponses!,
      retentionDays: retentionDays!,
      config,
    },
  };
}
