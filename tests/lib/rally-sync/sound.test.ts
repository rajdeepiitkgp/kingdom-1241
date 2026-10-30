// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CuePlayer } from "@/lib/rally-sync/sound";
import type { SoundCue } from "@/lib/rally-sync/timing";

/** Just enough of Web Audio to see what the player books. */
class FakeContext {
  state = "running";
  currentTime = 100;
  destination = {};
  started: Array<{ at: number; frequency: number }> = [];
  resume = vi.fn(async () => undefined);
  createGain() {
    const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: () => gain };
    return gain;
  }
  createOscillator() {
    const node = { type: "sine", frequency: { value: 0 }, connect: (target: unknown) => target, start: (at: number) => this.started.push({ at, frequency: node.frequency.value }), stop: () => undefined };
    return node;
  }
}

describe("CuePlayer", () => {
  let context: FakeContext;
  const now = 1_000_000;
  beforeEach(() => {
    context = new FakeContext();
    // `new AudioContext()` must construct: a class that hands back the fake.
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return context;
        }
      },
    );
    vi.spyOn(Date, "now").mockReturnValue(now);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is silent until a tap unlocks it, then books the cues ahead on the audio clock", () => {
    const player = new CuePlayer();
    const cues: SoundCue[] = [
      { at: now + 5_000, kind: "chime" },
      { at: now + 20_000, kind: "tick", step: 0 },
      { at: now + 30_000, kind: "go" },
      { at: now - 1_000, kind: "go" }, // already passed
      { at: now + 400_000, kind: "go" }, // beyond the lookahead: booked on a later sync
    ];
    player.sync(cues, 0);
    expect(player.unlocked).toBe(false);
    expect(context.started).toEqual([]);

    player.unlock();
    expect(player.unlocked).toBe(true);
    player.sync(cues, 0);
    // The chime is two tones 0.18 s apart, GO two tones at once; 5 s ahead lands at currentTime + 5.
    expect(context.started.map((s) => Number(s.at.toFixed(2)))).toEqual([105, 105.18, 120, 130, 130]);
    expect(context.started.map((s) => s.frequency)).toEqual([660, 880, 600, 1175, 587]);
  });

  it("rebooks when the cues or the clock correction change, and cancels on null", () => {
    const player = new CuePlayer();
    player.unlock();
    player.sync([{ at: now + 5_000, kind: "chime" }], 0);
    expect(context.started).toHaveLength(2);
    player.sync([{ at: now + 5_000, kind: "chime" }], 0); // same key: nothing new
    expect(context.started).toHaveLength(2);
    player.sync([{ at: now + 5_000, kind: "chime" }], 1_000); // the clock moved a second: rebooked
    expect(context.started).toHaveLength(4);
    player.sync(null, 1_000);
    player.sync([{ at: now + 5_000, kind: "chime" }], 1_000);
    expect(context.started).toHaveLength(6);
  });
});
