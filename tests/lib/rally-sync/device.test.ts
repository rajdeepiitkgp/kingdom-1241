// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { coordinatorLinkPath, EMPTY_DEVICE, forgetOldRooms, inviteLinkPath, parseDevice, parseRoomHash, recentRooms } from "@/lib/rally-sync/device";
import { DEFAULT_SETTINGS } from "@/lib/rally-sync/room";

const DAY = 24 * 60 * 60 * 1000;

describe("rally sync device memory", () => {
  it("treats missing or broken values as empty, with sound and screen-awake on", () => {
    expect(parseDevice(null)).toEqual(EMPTY_DEVICE);
    expect(parseDevice("not json")).toEqual(EMPTY_DEVICE);
    expect(parseDevice("[1,2]").rooms).toEqual({});
    expect(EMPTY_DEVICE.sound).toBe(true);
    expect(EMPTY_DEVICE.wakeLock).toBe(true);
  });

  it("keeps valid room entries and drops malformed parts", () => {
    const data = parseDevice(
      JSON.stringify({
        rooms: {
          K7M4QX: { coordinator: "c".repeat(32), leader: { id: "leader-1", token: "t".repeat(32) }, seenAt: 100, title: "Wave 1" },
          bad: { seenAt: 1 },
          ABCDEF: { leader: { id: "x" }, seenAt: 5 },
        },
        profile: { name: "Bear", marchSeconds: 42 },
        lastSettings: { mode: "counter", bufferSeconds: 0, rallyWaitSeconds: "x" },
        sound: false,
        gameOffsetSeconds: 2,
      }),
    );
    expect(Object.keys(data.rooms).sort()).toEqual(["ABCDEF", "K7M4QX"]);
    expect(data.rooms.K7M4QX.leader).toEqual({ id: "leader-1", token: "t".repeat(32) });
    expect(data.rooms.ABCDEF.leader).toBeUndefined();
    expect(data.profile).toEqual({ name: "Bear", marchSeconds: 42 });
    expect(data.lastSettings).toEqual({ ...DEFAULT_SETTINGS, mode: "counter", bufferSeconds: 0 });
    expect(data.sound).toBe(false);
    expect(data.wakeLock).toBe(true);
    expect(data.gameOffsetSeconds).toBe(2);
    expect(parseDevice(JSON.stringify({ gameOffsetSeconds: 999 })).gameOffsetSeconds).toBe(60);
  });

  it("keeps a garrison player's march time and send spacing, within range", () => {
    expect(EMPTY_DEVICE.garrison).toEqual({ marchSeconds: null, spacingSeconds: 5 });
    expect(parseDevice(JSON.stringify({ garrison: { marchSeconds: 31, spacingSeconds: 3 } })).garrison).toEqual({ marchSeconds: 31, spacingSeconds: 3 });
    expect(parseDevice(JSON.stringify({ garrison: { marchSeconds: 0, spacingSeconds: 99 } })).garrison).toEqual({ marchSeconds: null, spacingSeconds: 5 });
    expect(parseDevice(JSON.stringify({ lastSettings: { mode: "garrison" } })).lastSettings.mode).toBe("garrison");
  });

  it("lists today's rooms newest first and forgets older ones", () => {
    const now = 10 * DAY;
    const data = { ...EMPTY_DEVICE, rooms: { AAAAAA: { seenAt: now - 1000 }, BBBBBB: { seenAt: now - 10 }, CCCCCC: { seenAt: now - 2 * DAY } } };
    expect(recentRooms(data, now).map((r) => r.code)).toEqual(["BBBBBB", "AAAAAA"]);
    expect(Object.keys(forgetOldRooms(data, now).rooms).sort()).toEqual(["AAAAAA", "BBBBBB"]);
  });

  it("reads the invite key and coordinator token from the link's fragment", () => {
    const invite = "k".repeat(22);
    const coordinator = "c".repeat(32);
    expect(parseRoomHash(`#k=${invite}&c=${coordinator}`)).toEqual({ invite, coordinator });
    expect(parseRoomHash(`#k=${invite}`)).toEqual({ invite, coordinator: null });
    expect(parseRoomHash("#k=<script>")).toEqual({ invite: null, coordinator: null });
    expect(parseRoomHash("")).toEqual({ invite: null, coordinator: null });
    expect(inviteLinkPath("K7M4QX", invite)).toBe(`/tools/rally-sync/K7M4QX#k=${invite}`);
    expect(parseRoomHash(coordinatorLinkPath("K7M4QX", invite, coordinator).split("#")[1])).toEqual({ invite, coordinator });
  });
});
