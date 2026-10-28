// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { UI_STRINGS } from "@/content/seed/ui-strings";
import { ADMIN_TOURS } from "@/lib/admin/tours";
import { KVK_TOURS } from "@/lib/kvk/tours";
import { RALLY_SYNC_TOURS } from "@/lib/rally-sync/tours";
import { HOME_TOUR } from "@/lib/tour/home";
import type { Tour } from "@/lib/tour/tour";

/**
 * Every tour step must point at an element that still exists: a step whose
 * marker is gone is silently left out when the tour starts, so without this
 * a redesign would shorten a tour without anyone noticing.
 */

const PLAYER_TOURS: Tour[] = [...Object.values(RALLY_SYNC_TOURS), HOME_TOUR, ...Object.values(KVK_TOURS)];
const TOURS: Tour[] = [...PLAYER_TOURS, ...Object.values(ADMIN_TOURS)];

const SRC = resolve(__dirname, "../../../src");
const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : name.endsWith(".tsx") ? [join(dir, name)] : []));
// `data-tour="x"` on an element, `tour="x"` on a component that passes it on, `tour: "x"` / `…Tour: "x"` in a list or a form's settings.
const markers = new Set(files(SRC).flatMap((file) => [...readFileSync(file, "utf8").matchAll(/(?:data-tour|\btour)="([\w-]+)"|(?:\btour|Tour): "([\w-]+)"/g)].map((m) => m[1] ?? m[2])));

describe("guided tours", () => {
  it("point every step at a data-tour marker in the code", () => {
    const missing = TOURS.flatMap((tour) => tour.steps.filter((s) => s.target !== null && !markers.has(s.target)).map((s) => `${tour.id}: ${s.target}`));
    expect(missing).toEqual([]);
  });

  it("have unique ids, and player tours have texts in every hand-written language", () => {
    expect(new Set(TOURS.map((t) => t.id)).size).toBe(TOURS.length);
    for (const tour of TOURS) expect(tour.steps.length).toBeGreaterThan(0);
    const strings: Record<string, Record<string, string>> = UI_STRINGS;
    for (const tour of PLAYER_TOURS) {
      for (const key of tour.steps.flatMap((s) => [s.title, s.body])) {
        expect(Object.keys(strings[key] ?? {}).sort(), key).toEqual(["ar", "de", "en", "ko", "pl"]);
      }
    }
  });
});
