// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { pickVoice, speechParts } from "@/lib/tour/voice";

const voice = (name: string, lang: string, isDefault = false) => ({ name, lang, default: isDefault });

// The start of a Mac's list as Chrome shows it: the default voice first, then alphabetical with the character voices.
const mac = [
  voice("Samantha", "en-US", true),
  voice("Albert", "en-US"),
  voice("Anna", "de-DE"),
  voice("Daniel", "en-GB"),
  voice("Eddy (Korean (South Korea))", "ko-KR"),
  voice("Grandpa (German (Germany))", "de-DE"),
  voice("Majed", "ar-001"),
  voice("Yuna", "ko-KR"),
  voice("Zosia", "pl-PL"),
];

describe("choosing a voice for the tour's language", () => {
  it("finds one for each of the site's languages by its first subtag", () => {
    expect(pickVoice(mac, "en")?.name).toBe("Samantha");
    expect(pickVoice(mac, "de")?.name).toBe("Anna");
    expect(pickVoice(mac, "pl")?.name).toBe("Zosia");
    expect(pickVoice(mac, "ar")?.name).toBe("Majed");
  });

  it("passes over character voices listed before the plain one", () => {
    expect(pickVoice(mac, "ko")?.name).toBe("Yuna");
    expect(pickVoice([voice("Grandpa (German (Germany))", "de-DE"), voice("Anna", "de-DE")], "de")?.name).toBe("Anna");
    expect(pickVoice([voice("Albert", "en-US"), voice("Daniel", "en-GB")], "en")?.name).toBe("Daniel");
  });

  it("still uses a character voice when it is the only one for the language", () => {
    expect(pickVoice([voice("Eddy (Korean (South Korea))", "ko-KR")], "ko")?.name).toBe("Eddy (Korean (South Korea))");
  });

  it("prefers the device's default voice, then the exact tag", () => {
    expect(pickVoice([voice("Anna", "de-DE"), voice("Helena", "de-AT", true)], "de")?.name).toBe("Helena");
    expect(pickVoice([voice("Tingting", "zh-CN"), voice("Meijia", "zh-TW")], "zh-TW")?.name).toBe("Meijia");
    expect(pickVoice([voice("Tingting", "zh-CN")], "zh-TW")?.name).toBe("Tingting");
  });

  it("reads Android's underscores and any letter case", () => {
    expect(pickVoice([voice("de-de-x-nfh-local", "de_DE")], "de")?.name).toBe("de-de-x-nfh-local");
    expect(pickVoice([voice("Meijia", "ZH-tw")], "zh-TW")?.name).toBe("Meijia");
  });

  it("has nothing for a language the device can't speak, so the speaker stays hidden", () => {
    expect(pickVoice(mac, "ja")).toBeNull();
    expect(pickVoice([], "en")).toBeNull();
    expect(pickVoice([voice("Samantha", "en-US", true)], "ar")).toBeNull();
  });
});

describe("what a step says", () => {
  it("is the title, then the body sentence by sentence", () => {
    expect(speechParts("Your start time", "Start your rally at this time. The countdown counts to it!", "en")).toEqual([
      "Your start time",
      "Start your rally at this time.",
      "The countdown counts to it!",
    ]);
  });

  it("splits other scripts too", () => {
    expect(speechParts("시작 시간", "이 시간에 집결을 시작하세요. 카운트다운이 표시됩니다.", "ko")).toEqual(["시작 시간", "이 시간에 집결을 시작하세요.", "카운트다운이 표시됩니다."]);
    expect(speechParts("وقت البدء", "ابدأ التجمع في هذا الوقت. هل أنت جاهز؟ انطلق", "ar")).toEqual(["وقت البدء", "ابدأ التجمع في هذا الوقت.", "هل أنت جاهز؟", "انطلق"]);
  });

  it("leaves out emoji, which voices would read by name", () => {
    expect(speechParts("Lines", "Short ✅ Do / ⛔ Don't / ℹ️ Info lines.", "en")).toEqual(["Lines", "Short Do / Don't / Info lines."]);
  });

  it("takes Android's underscore tags and never throws on a tag it can't read", () => {
    expect(speechParts("T", "One. Two.", "de_DE")).toEqual(["T", "One.", "Two."]);
    for (const tag of ["sr_ME_#Latn", "", "not a tag"]) expect(speechParts("T", "One. Two.", tag)).toEqual(["T", "One. Two."]);
  });

  it("skips empty parts", () => {
    expect(speechParts("Title", "", "en")).toEqual(["Title"]);
    expect(speechParts("", "  ", "en")).toEqual([]);
  });
});
