import { describe, expect, it } from "vitest";
import { parseRetroSettingsForm } from "@/lib/admin/retro-forms";
import { configFieldName } from "@/lib/retro/questions";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const valid = {
  open: "on",
  title: "How did the castle battle go?",
  introSource: "Two minutes, please.",
  closesAt: "2026-11-05T20:00",
  maxResponses: "600",
  retentionDays: "30",
  [configFieldName("rating", "overall", "shown")]: "on",
  [configFieldName("rating", "overall", "required")]: "on",
  [configFieldName("text", "suggestions", "shown")]: "on",
};

describe("parseRetroSettingsForm", () => {
  it("accepts complete settings", () => {
    const result = parseRetroSettingsForm(form(valid));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.open).toBe(true);
    expect(result.value.closesAt).toBe("2026-11-05T20:00:00.000Z");
    expect(result.value.maxResponses).toBe(600);
    expect(result.value.retentionDays).toBe(30);
    expect(result.value.config.ratings.overall).toEqual({ shown: true, required: true });
    expect(result.value.config.ratings.planning.shown).toBe(false);
    expect(result.value.config.texts.suggestions).toEqual({ shown: true, required: false });
  });

  it("allows an empty closing time and intro", () => {
    const result = parseRetroSettingsForm(form({ ...valid, closesAt: "", introSource: "" }));
    expect(result.ok && result.value.closesAt).toBeNull();
  });

  it("reports every problem at once", () => {
    const fd = form({ ...valid, title: "", closesAt: "yesterday", maxResponses: "5000", retentionDays: "3" });
    fd.delete(configFieldName("rating", "overall", "shown"));
    fd.delete(configFieldName("text", "suggestions", "shown"));
    const result = parseRetroSettingsForm(fd);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["closesAt", "config", "maxResponses", "retentionDays", "title"]);
  });
});
