// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { UI_STRINGS } from "@/content/seed/ui-strings";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { counterChat, garrisonChat, rallyChat } from "@/lib/rally-sync/chat";
import { counterOrder } from "@/lib/rally-sync/counter";
import type { EnemyRally } from "@/lib/rally-sync/garrison";

const dictionary = (lang: "en" | "de") => Object.fromEntries(Object.entries(UI_STRINGS).map(([key, text]) => [key, text[lang]])) as Dictionary;
const en = dictionary("en");
const at = (time: string) => Date.parse(`2026-11-07T${time}Z`);

const rally = (id: string, name: string, launch: string, marchSeconds: number): EnemyRally => ({ id, enemyId: id, name, marchSeconds, launchAt: new Date(at(launch)).toISOString(), movedAt: null });

describe("the garrison chat summary", () => {
  it("puts every enemy hit and every refill on its own line, with a blank line between", () => {
    const wave = [rally("a", "Demo enemy A", "21:41:23", 42), rally("b", "Demo enemy B", "21:41:17", 38), rally("c", "Demo enemy C", "21:41:02", 45)];
    expect(garrisonChat(wave, "UTC", en).split("\n")).toEqual([
      "Enemy rallies hit our castle (UTC):",
      "Demo enemy C 21:41:47",
      "Demo enemy B 21:41:55",
      "Demo enemy A 21:42:05",
      "",
      "Our refills land (UTC):",
      "21:41:50",
      "21:41:58",
      "Send at that time minus your march.",
    ]);
  });

  it("says so when the hits leave no gap", () => {
    const wave = [rally("a", "A", "21:41:00", 40), rally("b", "B", "21:41:00", 40)];
    expect(garrisonChat(wave, "UTC", en).split("\n").slice(-2)).toEqual(["", en["sync.gar.chatNoGap"]]);
  });
});

describe("the rally chat summary", () => {
  const leaders = [
    { name: "Bob", startAt: at("21:39:20") },
    { name: "Sitting out", startAt: null },
    { name: "Alice", startAt: at("21:39:12") },
  ];

  it("gives the hit time, then every leader's start, earliest first, with the rally timer", () => {
    expect(rallyChat({ hitAt: at("21:45:00"), rallyWaitSeconds: 300, hitSetAt: null, leaders }, "UTC", en).split("\n")).toEqual([
      "Our rallies hit 21:45:00 (UTC)",
      "",
      "Start your rally (5:00 timer) at:",
      "Alice 21:39:12",
      "Bob 21:39:20",
    ]);
  });

  it("marks a leader whose start was over when the hit time was set, instead of a time that has gone", () => {
    // The hit was typed at 21:39:15 with a 5:00 rally timer: Alice's start was already over.
    const text = rallyChat({ hitAt: at("21:45:00"), rallyWaitSeconds: 300, hitSetAt: at("21:39:15"), leaders }, "UTC", en);
    expect(text.split("\n").slice(-2)).toEqual(["Alice: too late for this hit", "Bob 21:39:20"]);
  });

  it("uses the coordinator's language", () => {
    const text = rallyChat({ hitAt: at("21:45:00"), rallyWaitSeconds: 300, hitSetAt: null, leaders }, "UTC", dictionary("de"));
    expect(text.split("\n").slice(0, 3)).toEqual(["Unsere Rallys treffen 21:45:00 (UTC)", "", "Starte deine Rally (5:00-Timer) um:"]);
  });
});

describe("the counter-rally chat summary", () => {
  it("gives the launch order with every leader's cue, one per line", () => {
    const steps = counterOrder([{ name: "Tom", marchSeconds: 40 }, { name: "Rajx", marchSeconds: 52 }, { name: "Mira", marchSeconds: 45 }], 300);
    expect(counterChat(steps, 300, en).split("\n")).toEqual([
      "Counter order (5:00 timer), start when that rally shows:",
      "1. Rajx: first, on the main alliance's go",
      "2. Mira: Rajx 4:53",
      "3. Tom: Rajx 4:48 / Mira 4:55",
    ]);
  });

  it("gives the same order in seconds after the earlier rallies started, for leaders who count", () => {
    const steps = counterOrder([{ name: "Tom", marchSeconds: 40 }, { name: "Rajx", marchSeconds: 52 }, { name: "Mira", marchSeconds: 45 }], 300);
    expect(counterChat(steps, 300, en, "seconds").split("\n")).toEqual([
      "Counter order, start this long after that rally started:",
      "1. Rajx: first, on the main alliance's go",
      "2. Mira: Rajx +7 s",
      "3. Tom: Rajx +12 s / Mira +5 s",
    ]);
  });

  it("counts seconds after the first start when a rally's countdown has already run out", () => {
    const steps = counterOrder([{ name: "Ali", marchSeconds: 45 }, { name: "New", marchSeconds: 30 }], 10);
    expect(counterChat(steps, 10, en).split("\n").at(-1)).toBe("2. New: 15 s after Ali");
  });
});
