// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import {
  chatSummary,
  clearRallies,
  currentWave,
  defaultEnemyName,
  EMPTY_GARRISON,
  type EnemyLeader,
  type EnemyRally,
  type GarrisonState,
  launchFromTap,
  markRally,
  MAX_ENEMIES,
  MAX_TAP_SKEW_MS,
  nudgeRally,
  parseGarrison,
  planRefills,
  playerPlan,
  rallyHit,
  rallyLands,
  refillCues,
  refillStage,
  refillWindows,
  removeEnemy,
  saveEnemy,
  sendNowAdvice,
  setEnemyActive,
  speedupFor,
  tapMoment,
  windowUpdated,
} from "@/lib/rally-sync/garrison";

const at = (time: string) => Date.parse(`2026-11-07T${time}Z`);
const iso = (time: string) => new Date(at(time)).toISOString();

const enemy = (id: string, marchSeconds: number, extra: Partial<EnemyLeader> = {}): EnemyLeader => ({
  id,
  name: `Enemy ${id}`,
  marchSeconds,
  active: true,
  previousMarchSeconds: null,
  marchChangedAt: null,
  ...extra,
});

const rally = (id: string, enemyId: string, launch: string, marchSeconds: number, extra: Partial<EnemyRally> = {}): EnemyRally => ({
  id,
  enemyId,
  name: `Enemy ${enemyId}`,
  marchSeconds,
  launchAt: iso(launch),
  movedAt: null,
  ...extra,
});

const ok = (edit: ReturnType<typeof markRally>): GarrisonState => {
  if (!edit.ok) throw new Error(`refused: ${edit.error}`);
  return edit.state;
};

describe("refill windows", () => {
  it("aims between two hits, none between hits in the same second or a second apart", () => {
    // The reviewer's case: two rallies at :25, the third two seconds later.
    expect(refillWindows([at("12:10:25"), at("12:10:25"), at("12:10:27")])).toEqual([{ after: at("12:10:25"), before: at("12:10:27"), target: at("12:10:26") }]);
    expect(refillWindows([at("12:10:25"), at("12:10:26")])).toEqual([]);
    expect(refillWindows([at("12:10:25")])).toEqual([]);
  });

  it("sorts the hits and finds every gap; nothing after the last hit", () => {
    const windows = refillWindows([at("12:10:31"), at("12:10:25"), at("12:10:28")]);
    expect(windows.map((w) => w.target)).toEqual([at("12:10:26"), at("12:10:29")]);
  });

  it("aims at the middle of a short gap, earlier when it can't be exact, and never more than 3 s after a hit", () => {
    expect(refillWindows([at("12:10:25"), at("12:10:28")])[0].target).toBe(at("12:10:26"));
    expect(refillWindows([at("12:10:25"), at("12:10:29")])[0].target).toBe(at("12:10:27"));
    expect(refillWindows([at("12:10:25"), at("12:12:00")])[0].target).toBe(at("12:10:28"));
  });
});

describe("the game-chat summary", () => {
  it("lists every hit with its leader in time order, and the refill windows", () => {
    const wave = [rally("r2", "b", "12:09:50", 38), rally("r1", "a", "12:09:43", 42), rally("r3", "c", "12:09:43", 45)];
    expect(chatSummary(wave)).toEqual({
      // b and c land in the same second: by name.
      hits: [
        { name: "Enemy a", at: at("12:10:25") },
        { name: "Enemy b", at: at("12:10:28") },
        { name: "Enemy c", at: at("12:10:28") },
      ],
      windows: [at("12:10:26")],
    });
    expect(chatSummary([])).toEqual({ hits: [], windows: [] });
  });
});

describe("speedups", () => {
  it("cuts the time left by its percentage: 25% at 4 × the delay, else 50% at 2 ×, else nothing", () => {
    // The reviewer's example: sent 4 s late with a 31 s march, 25% at 0:16 left.
    expect(speedupFor(4, 31)).toEqual({ percent: 25, atLeft: 16 });
    expect(speedupFor(7, 31)).toEqual({ percent: 25, atLeft: 28 });
    expect(speedupFor(8, 31)).toEqual({ percent: 50, atLeft: 16 });
    expect(speedupFor(15, 31)).toEqual({ percent: 50, atLeft: 30 });
    expect(speedupFor(16, 31)).toBeNull();
  });
});

describe("a player's plan", () => {
  const windows = refillWindows([at("12:10:25"), at("12:10:27"), at("12:10:30")]);

  it("sends on time when it can and spaces the next send with a speedup that lands it in its window", () => {
    const [first, second] = planRefills(windows, 31, 5);
    expect(first).toMatchObject({ kind: "send", number: 1, sendAt: at("12:09:55"), lateSeconds: 0, speedup: null, speedupAt: null });
    // Due at 12:09:57, but the player needs 5 s between sends: 12:10:00, 3 s late → 25% at 0:12 left (12:10:19).
    expect(second).toMatchObject({ kind: "send", number: 2, sendAt: at("12:10:00"), lateSeconds: 3, speedup: { percent: 25, atLeft: 12 }, speedupAt: at("12:10:19") });
    // Check the landing: 19 s of march, then the 12 s left cut by a quarter to 9 s.
    if (second.kind !== "send" || !second.speedup) throw new Error("expected a speedup");
    expect(second.sendAt + 19_000 + second.speedup.atLeft * 750).toBe(second.window.target);
  });

  it("skips a window even 50% can't reach after the previous send, and plans the next from the last real send", () => {
    // Refills due at 12:10:26, 12:10:30 and 12:11:33; this player needs 30 s between sends.
    const three = refillWindows([at("12:10:25"), at("12:10:27"), at("12:11:30"), at("12:11:40")]);
    const steps = planRefills(three, 31, 30);
    expect(steps.map((s) => s.kind)).toEqual(["send", "skip", "send"]);
    expect(steps[2]).toMatchObject({ sendAt: at("12:11:02"), lateSeconds: 0 });
  });

  it("needs the player's march time, and has nothing to do without an incoming wave", () => {
    const state: GarrisonState = { enemies: [], rallies: [rally("r1", "a", "12:10:00", 25), rally("r2", "b", "12:10:00", 27)] };
    expect(playerPlan(state, at("12:09:00"), null, 5)).toMatchObject({ steps: [] });
    expect(playerPlan(state, at("12:09:00"), 31, 5).steps).toHaveLength(1);
    expect(playerPlan(EMPTY_GARRISON, at("12:09:00"), 31, 5)).toEqual({ wave: [], windows: [], steps: [] });
  });

  it("tells a player who missed the second what still works if they send now", () => {
    const target = at("12:10:26");
    expect(sendNowAdvice(target, 31, at("12:09:54.5"))).toEqual({ lateSeconds: 0, speedup: null });
    expect(sendNowAdvice(target, 31, at("12:09:59.2"))).toEqual({ lateSeconds: 4, speedup: { percent: 25, atLeft: 16 } });
    expect(sendNowAdvice(target, 31, at("12:10:11"))).toEqual({ lateSeconds: 16, speedup: null });
  });

  it("walks a step through countdown, send, speedup and landing", () => {
    const step = planRefills(windows, 31, 5)[1];
    if (step.kind !== "send") throw new Error("expected a send");
    expect(refillStage(step, at("12:09:58"))).toBe("upcoming");
    expect(refillStage(step, at("12:10:00.4"))).toBe("send");
    expect(refillStage(step, at("12:10:10"))).toBe("speedup");
    expect(refillStage(step, at("12:10:19.5"))).toBe("boost");
    expect(refillStage(step, at("12:10:25"))).toBe("marching");
    expect(refillStage(step, at("12:10:29"))).toBe("done");
  });

  it("beeps for every send and speedup, with one chime 30 s before the first", () => {
    const cues = refillCues(planRefills(windows, 31, 5));
    expect(cues[0]).toEqual({ at: at("12:09:25"), kind: "chime" });
    expect(cues.filter((c) => c.kind === "go").map((c) => c.at)).toEqual([at("12:09:55"), at("12:10:00"), at("12:10:19")]);
    expect(cues.filter((c) => c.kind === "tick")).toHaveLength(9);
    expect(refillCues([])).toEqual([]);
  });
});

describe("waves", () => {
  const state: GarrisonState = { enemies: [], rallies: [rally("r1", "a", "12:09:43", 42), rally("r2", "b", "12:09:50", 38)] };

  it("keeps the wave until 30 s after its last hit, earliest hit first, then starts empty", () => {
    expect(currentWave(state.rallies, at("12:10:00")).map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(currentWave(state.rallies, at("12:10:57"))).toHaveLength(2);
    expect(currentWave(state.rallies, at("12:10:58"))).toEqual([]);
  });

  it("flags a refill whose hits the coordinator moved in the last 20 seconds", () => {
    const moved = [rally("r1", "a", "12:09:43", 42, { movedAt: iso("12:09:30") }), rally("r2", "b", "12:09:50", 38)];
    const [window] = refillWindows(moved.map(rallyHit));
    expect(windowUpdated(window, moved, at("12:09:40"))).toBe(true);
    expect(windowUpdated(window, moved, at("12:09:51"))).toBe(false);
  });
});

describe("marking rallies (the coordinator's taps)", () => {
  const base: GarrisonState = { enemies: [enemy("a", 42), enemy("b", 38)], rallies: [] };
  const now = at("12:05:00");

  it("puts the launch at the tap plus the countdown, on the whole second", () => {
    expect(launchFromTap(at("12:05:00.300"), 270)).toBe(at("12:09:30"));
    expect(launchFromTap(at("12:05:00.600"), 270)).toBe(at("12:09:31"));
  });

  it("trusts the page's tap moment only near the server's clock", () => {
    expect(tapMoment(now - 800, now)).toBe(now - 800);
    expect(tapMoment(now - MAX_TAP_SKEW_MS - 1, now)).toBe(now);
    expect(tapMoment("soon", now)).toBe(now);
  });

  it("adds a rally, and a second button press for the same leader moves it instead (until it launches)", () => {
    const first = ok(markRally(base, "a", at("12:09:30"), now, "r1"));
    expect(first.rallies).toEqual([rally("r1", "a", "12:09:30", 42)]);
    // Tapped 4:30 by mistake; 3:30 was right.
    const fixed = ok(markRally(first, "a", at("12:08:30"), now + 5000, "r2"));
    expect(fixed.rallies).toEqual([{ ...rally("r1", "a", "12:08:30", 42), movedAt: new Date(now + 5000).toISOString() }]);
    // After it launched, the same leader's next countdown is a new rally.
    const next = ok(markRally(fixed, "a", at("12:14:00"), at("12:08:40"), "r3"));
    expect(next.rallies.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  it("refuses a launch in the past, an unknown leader and a full list; drops a finished wave first", () => {
    expect(markRally(base, "a", now, now, "x")).toEqual({ ok: false, error: "past" });
    expect(markRally(base, "zz", at("12:09:00"), now, "x")).toEqual({ ok: false, error: "missing" });
    const old: GarrisonState = { ...base, rallies: [rally("old", "b", "11:00:00", 38)] };
    expect(ok(markRally(old, "a", at("12:09:00"), now, "r1")).rallies.map((r) => r.id)).toEqual(["r1"]);
  });

  it("nudges a rally a second at a time until it launches", () => {
    const state = ok(markRally(base, "a", at("12:09:30"), now, "r1"));
    expect(ok(nudgeRally(state, "r1", 1, now)).rallies[0].launchAt).toBe(iso("12:09:31"));
    expect(nudgeRally(state, "r1", -1, at("12:09:35"))).toEqual({ ok: false, error: "launched" });
    expect(nudgeRally(state, "r1", -1, at("12:10:43"))).toEqual({ ok: false, error: "missing" }); // landed over 30 s ago: the wave is gone
    expect(nudgeRally(state, "r1", 0, now)).toEqual({ ok: false, error: "invalid" });
  });

  it("learns the real march time from an observed landing (a guessed leader, or pets) and keeps the old one", () => {
    const guessed = ok(markRally(base, "b", at("12:09:00"), now, "r1"));
    // Launched at 12:09:00; at 12:09:10 the incoming march shows 0:22 → lands 12:09:32, a 32 s march (not 38).
    const learned = ok(rallyLands(guessed, "b", at("12:09:32"), at("12:09:10"), "x"));
    expect(learned.rallies[0]).toMatchObject({ id: "r1", marchSeconds: 32, movedAt: iso("12:09:10") });
    expect(learned.enemies.find((e) => e.id === "b")).toMatchObject({ marchSeconds: 32, previousMarchSeconds: 38, marchChangedAt: iso("12:09:10") });
  });

  it("without a marching rally, works the launch back from the leader's march time", () => {
    const state = ok(rallyLands(base, "a", at("12:05:30"), now, "r1"));
    expect(state.rallies).toEqual([rally("r1", "a", "12:04:48", 42)]);
    expect(state.enemies).toEqual(base.enemies);
  });
});

describe("the list of enemy leaders", () => {
  const now = at("12:00:00");

  it("adds leaders up to the limit, naming unnamed ones #1, #2 …", () => {
    expect(defaultEnemyName([])).toBe("#1");
    expect(defaultEnemyName([{ name: "#1" }, { name: "#3" }])).toBe("#2");
    const added = ok(saveEnemy(EMPTY_GARRISON, { name: "#1", marchSeconds: 40 }, "a", now));
    expect(added.enemies).toEqual([enemy("a", 40, { name: "#1" })]);
    const full: GarrisonState = { enemies: Array.from({ length: MAX_ENEMIES }, (_, i) => enemy(`e${i}`, 30)), rallies: [] };
    expect(saveEnemy(full, { name: "x", marchSeconds: 30 }, "new", now)).toEqual({ ok: false, error: "too_many" });
  });

  it("remembers the previous march time and carries a new one into a rally that hasn't launched", () => {
    const state: GarrisonState = { enemies: [enemy("a", 42)], rallies: [rally("r1", "a", "12:03:00", 42), rally("r0", "a", "11:59:50", 42)] };
    const edited = ok(saveEnemy(state, { id: "a", name: "Enemy a", marchSeconds: 30 }, "x", now));
    expect(edited.enemies[0]).toMatchObject({ marchSeconds: 30, previousMarchSeconds: 42, marchChangedAt: iso("12:00:00") });
    expect(edited.rallies.find((r) => r.id === "r1")).toMatchObject({ marchSeconds: 30, movedAt: iso("12:00:00") });
    expect(edited.rallies.find((r) => r.id === "r0")).toMatchObject({ marchSeconds: 42 }); // launched: only a landing changes it
  });

  it("ticks leaders in and out, removes one without touching their marked rally, and clears the incoming list", () => {
    const state: GarrisonState = { enemies: [enemy("a", 42)], rallies: [rally("r1", "a", "12:03:00", 42)] };
    expect(ok(setEnemyActive(state, "a", false)).enemies[0].active).toBe(false);
    expect(setEnemyActive(state, "b", false)).toEqual({ ok: false, error: "missing" });
    expect(ok(removeEnemy(state, "a"))).toEqual({ enemies: [], rallies: state.rallies });
    expect(ok(clearRallies(state))).toEqual({ enemies: state.enemies, rallies: [] });
  });
});

describe("the stored column", () => {
  it("keeps well-formed leaders and rallies and drops anything else", () => {
    const value = {
      enemies: [enemy("a", 42), { id: "b", name: "", marchSeconds: 40 }, { id: "c", name: "C", marchSeconds: 0 }, "junk"],
      rallies: [rally("r1", "a", "12:00:00", 42), { id: "r2", enemyId: "a", name: "A", marchSeconds: 40, launchAt: "not a time" }],
    };
    expect(parseGarrison(value)).toEqual({ enemies: [enemy("a", 42)], rallies: [rally("r1", "a", "12:00:00", 42)] });
    expect(parseGarrison(null)).toEqual(EMPTY_GARRISON);
    expect(parseGarrison({})).toEqual(EMPTY_GARRISON);
    expect(parseGarrison({ enemies: [{ ...enemy("a", 42), active: undefined }] }).enemies[0].active).toBe(true);
  });
});
