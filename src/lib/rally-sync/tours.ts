// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { UiKey } from "@/content/seed/ui-strings";
import { type Tour, uiStep } from "@/lib/tour/tour";
import type { RoomMode } from "./room";

/**
 * The guided tour of a room, one per mode, opened from the "?" in the status
 * line. Coordinator steps point at the coordinator's panel, so leaders and
 * watchers never see them; steps for things a page doesn't show right now
 * (the copy button before a hit time is set) are left out the same way.
 */

const status = uiStep("sync-status", "sync.status");
const clock = uiStep("sync-clock", "sync.clock");
const sound = uiStep("sync-sound", "sync.sound");
const wake = uiStep("sync-wake", "sync.wake");
const me = uiStep("sync-me", "sync.me", "sync.me.title");
const coordinator = uiStep("sync-coordinator", "sync.coordinator");
const more = uiStep("sync-more", "sync.more", "sync.coord.more");

export const RALLY_SYNC_TOURS: Record<RoomMode, Tour<UiKey>> = {
  rally: {
    id: "sync-rally",
    version: 1,
    steps: [
      status,
      clock,
      sound,
      wake,
      uiStep("sync-focus", "sync.focus"),
      me,
      uiStep("sync-leaders", "sync.leaders"),
      coordinator,
      uiStep("sync-resync", "sync.resync"),
      uiStep("sync-hit", "sync.hit"),
      uiStep("sync-copy", "sync.copy", "sync.copyChat"),
      more,
    ],
  },
  garrison: {
    id: "sync-garrison",
    version: 1,
    steps: [
      status,
      clock,
      sound,
      wake,
      uiStep("gar-march", "gar.march"),
      uiStep("gar-refills", "gar.refills"),
      coordinator,
      uiStep("gar-windows", "gar.windows", "sync.gar.windows"),
      uiStep("gar-enemies", "gar.enemies"),
      uiStep("gar-edit", "gar.edit"),
      more,
    ],
  },
  counter: {
    id: "sync-counter",
    version: 1,
    steps: [status, clock, wake, uiStep("counter-focus", "counter.focus"), me, uiStep("counter-order", "counter.order"), coordinator, uiStep("counter-copy", "counter.copy", "sync.copyChat"), more],
  },
};
