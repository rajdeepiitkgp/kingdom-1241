// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { stepKeys } from "@/components/rally-sync/step-keys";

function press(key: string, value: string, modifiers: Partial<Pick<KeyboardEvent, "shiftKey" | "altKey" | "ctrlKey" | "metaKey">> = {}) {
  const input = { value };
  const event = { key, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...modifiers, currentTarget: input, preventDefault: vi.fn() };
  return { event: event as unknown as KeyboardEvent<HTMLInputElement>, input, prevented: () => event.preventDefault.mock.calls.length > 0 };
}

describe("stepKeys", () => {
  it("moves a clock a second, ten with Shift, and keeps the typed format", () => {
    const keys = stepKeys("clock", "hint");
    const up = press("ArrowUp", "12:00:59");
    keys.onKeyDown(up.event);
    expect(up.input.value).toBe("12:01:00");
    expect(up.prevented()).toBe(true);
    const down = press("ArrowDown", "12:00", { shiftKey: true });
    keys.onKeyDown(down.event);
    expect(down.input.value).toBe("11:59:50");
    expect(keys.title).toBe("hint");
    expect(keys["aria-keyshortcuts"]).toContain("ArrowUp");
  });

  it("respects the bounds and seeds an empty field", () => {
    const keys = stepKeys("seconds", "hint", { min: 0, max: 30, seed: () => "29" });
    const over = press("ArrowUp", "30");
    keys.onKeyDown(over.event);
    expect(over.input.value).toBe("30");
    const empty = press("ArrowUp", "");
    keys.onKeyDown(empty.event);
    expect(empty.input.value).toBe("30");
  });

  it("leaves other keys and modifier chords to the browser", () => {
    const keys = stepKeys("seconds", "hint");
    for (const { event, input, prevented } of [press("Enter", "5"), press("ArrowUp", "5", { ctrlKey: true }), press("ArrowUp", "5", { metaKey: true }), press("ArrowUp", "5", { altKey: true })]) {
      keys.onKeyDown(event);
      expect(input.value).toBe("5");
      expect(prevented()).toBe(false);
    }
  });
});
