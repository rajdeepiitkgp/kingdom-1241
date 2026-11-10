// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { randomUUID } from "node:crypto";
import { nextRound, roundFor, SCORING_DAYS, type ScoringDay } from "@/lib/kvk/prep";
import { roundKey } from "@/lib/kvk/prep-schedule";
import type { Appointment } from "./assign";
import { type Amounts, isScoringDay, type MinistrySettings, NO_AMOUNTS, pickBlocks, type SlotChoice } from "./ministry";
import type { MinistryStore, RoundRoster, StoredSignup } from "./store-types";

/**
 * The ministry sign-ups without a database, for reviewing the pages locally
 * and for the browser tests (MINISTRY_STORE=memory; ignored on Vercel).
 * Everything lives in this server process and vanishes on restart.
 *
 * The round after the current one is open from the start and holds a handful
 * of demo players, so the moderators' list has something to show.
 * Construction and research keep the default deadlines (always weeks ahead, so
 * the tests see the same page on any date); the training day's deadline has
 * passed, so its appointments are given out on the first visit and the roster
 * shows.
 */

interface Memory {
  settings: MinistrySettings;
  signups: Map<string, StoredSignup>;
  appointments: Array<Appointment & { round: string }>;
  /** `<round>:<day>` → when the day's assignment ran. */
  assigned: Map<string, string>;
  /** `<round>:<day>` → what players see since the day's last publish. */
  published: Map<string, { at: string; rows: Appointment[] }>;
}

// Server Actions and pages are separate bundles: one copy on globalThis.
const holder = globalThis as typeof globalThis & { __ministryMemory?: Memory };

const DEMO: Array<{ name: string; tag: string | null; power: number; amounts: Partial<Amounts>; blocks: number[] }> = [
  { name: "Aurelia", tag: "NAM", power: 182_400_000, amounts: { truegold: 4200, temperedTruegold: 310, tgDust: 62_000, constructionMinutes: 41 * 1440, researchMinutes: 28 * 1440, trainingMinutes: 55 * 1440 }, blocks: [6, 7, 8, 9] },
  { name: "Borin", tag: "NAM", power: 96_300_000, amounts: { truegold: 1800, temperedTruegold: 90, tgDust: 21_000, constructionMinutes: 17 * 1440, researchMinutes: 9 * 1440, trainingMinutes: 30 * 1440 }, blocks: [8, 9, 10] },
  { name: "Cyra", tag: "Nam", power: 61_750_000, amounts: { truegold: 950, temperedTruegold: 20, tgDust: 9500, constructionMinutes: 8 * 1440 + 360, researchMinutes: 4 * 1440, trainingMinutes: 12 * 1440 }, blocks: [0, 1, 11] },
  { name: "Dmitri", tag: "NAM", power: 143_900_000, amounts: { truegold: 3100, temperedTruegold: 240, tgDust: 48_000, constructionMinutes: 33 * 1440, researchMinutes: 22 * 1440, trainingMinutes: 40 * 1440 }, blocks: [8, 9] },
  { name: "Eun-ji", tag: null, power: 38_200_000, amounts: { truegold: 400, tgDust: 3000, constructionMinutes: 3 * 1440, researchMinutes: 1440, trainingMinutes: 5 * 1440 }, blocks: [2, 3, 4] },
  { name: "Farid", tag: "Nam", power: 77_000_000, amounts: { truegold: 1200, temperedTruegold: 45, tgDust: 15_500, constructionMinutes: 11 * 1440, researchMinutes: 6 * 1440 + 720, trainingMinutes: 21 * 1440 }, blocks: [9, 10, 11] },
];

function demoSignups(round: string): StoredSignup[] {
  const blocks = pickBlocks(120);
  return DEMO.map((player, index) => {
    const slots: SlotChoice = {};
    for (const day of SCORING_DAYS) slots[day] = player.blocks.flatMap((block) => blocks[block] ?? []);
    const at = new Date(Date.UTC(2026, 10, 9, 8, index * 7)).toISOString();
    return {
      id: randomUUID(),
      round,
      governorId: String(40_000_001 + index),
      gameName: player.name,
      allianceTag: player.tag,
      verified: true,
      power: player.power,
      amounts: { ...NO_AMOUNTS, ...player.amounts },
      slots,
      disabled: false,
      deviceHash: null,
      locale: "en",
      createdAt: at,
      updatedAt: at,
    };
  });
}

function memory(): Memory {
  if (!holder.__ministryMemory) {
    const round = roundKey(nextRound(roundFor(new Date())));
    holder.__ministryMemory = {
      // The training day's deadline lies behind us, so its roster shows; the other days keep the default (weeks ahead).
      settings: { [round]: { open: true, deadlines: { 4: "2026-11-01T00:00:00.000Z" } } },
      signups: new Map(demoSignups(round).map((signup) => [signup.id, signup])),
      appointments: [],
      assigned: new Map(),
      published: new Map(),
    };
  }
  return holder.__ministryMemory;
}

const byCreated = (a: StoredSignup, b: StoredSignup) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

export function memoryMinistryStore(): MinistryStore {
  const state = memory();
  const inRound = (round: string) => [...state.signups.values()].filter((signup) => signup.round === round).sort(byCreated);
  return {
    async settings() {
      return structuredClone(state.settings);
    },
    async saveSettings(value) {
      state.settings = structuredClone(value.rounds);
    },
    async list(round) {
      return structuredClone(inRound(round));
    },
    async count(round) {
      return inRound(round).length;
    },
    async get(id) {
      const signup = state.signups.get(id);
      return signup ? structuredClone(signup) : null;
    },
    async byGovernor(round, governorId) {
      const signup = inRound(round).find((entry) => entry.governorId === governorId);
      return signup ? structuredClone(signup) : null;
    },
    async byDevice(round, deviceHash) {
      return structuredClone(inRound(round).filter((entry) => entry.deviceHash === deviceHash));
    },
    async insert(row) {
      if (inRound(row.round).some((entry) => entry.governorId === row.governorId)) return "duplicate";
      const now = new Date().toISOString();
      const signup: StoredSignup = { ...structuredClone(row), id: randomUUID(), disabled: false, createdAt: now, updatedAt: now };
      state.signups.set(signup.id, signup);
      return structuredClone(signup);
    },
    async update(id, patch) {
      const signup = state.signups.get(id);
      if (!signup) return null;
      const next: StoredSignup = { ...signup, ...structuredClone(patch), updatedAt: new Date().toISOString() };
      state.signups.set(id, next);
      return structuredClone(next);
    },
    async remove(id) {
      state.appointments = state.appointments.filter((held) => held.signupId !== id);
      return state.signups.delete(id);
    },
    async removeRound(round) {
      const gone = inRound(round);
      for (const signup of gone) state.signups.delete(signup.id);
      state.appointments = state.appointments.filter((held) => held.round !== round);
      for (const key of [...state.assigned.keys()]) if (key.startsWith(`${round}:`)) state.assigned.delete(key);
      for (const key of [...state.published.keys()]) if (key.startsWith(`${round}:`)) state.published.delete(key);
      return gone.length;
    },
    async roster(round) {
      const assignedAt: RoundRoster["assignedAt"] = {};
      const published: RoundRoster["published"] = {};
      const publishedAt: RoundRoster["publishedAt"] = {};
      for (const [key, at] of state.assigned) {
        const [of, day] = key.split(":");
        if (of !== round || !isScoringDay(Number(day))) continue;
        assignedAt[Number(day) as ScoringDay] = at;
        const live = state.published.get(key);
        if (live) {
          published[Number(day) as ScoringDay] = structuredClone(live.rows);
          publishedAt[Number(day) as ScoringDay] = live.at;
        }
      }
      const appointments = state.appointments.filter((held) => held.round === round).map(({ signupId, day, slot, source }) => ({ signupId, day, slot, source }));
      return { appointments: appointments.sort((a, b) => a.day - b.day || a.slot - b.slot), assignedAt, available: true, published, publishedAt, drafts: true };
    },
    async publish(round, day) {
      const rows = state.appointments.filter((held) => held.round === round && held.day === day).map(({ signupId, slot, source }) => ({ signupId, day, slot, source }));
      state.published.set(`${round}:${day}`, { at: new Date().toISOString(), rows: rows.sort((a, b) => a.slot - b.slot) });
    },
    async restore(round, day) {
      const live = state.published.get(`${round}:${day}`);
      if (!live) return false;
      const others = state.appointments.filter((held) => !(held.round === round && held.day === day));
      state.appointments = [...others, ...live.rows.filter((row) => state.signups.has(row.signupId)).map((row) => ({ ...row, round }))];
      return true;
    },
    async clearAppointments(round, day) {
      state.appointments = state.appointments.filter((held) => !(held.round === round && held.day === day));
    },
    async assign(round, day, rows, first) {
      const key = `${round}:${day}`;
      if (first && state.assigned.has(key)) return "skipped";
      const kept = state.appointments.filter((held) => !(held.round === round && held.day === day && held.source === "auto"));
      const fixed = kept.filter((held) => held.round === round && held.day === day);
      if (rows.some((row) => fixed.some((held) => held.slot === row.slot || held.signupId === row.signupId))) return "clash";
      state.appointments = [...kept, ...rows.map((row) => ({ round, day, slot: row.slot, signupId: row.signupId, source: "auto" as const }))];
      state.assigned.set(key, new Date().toISOString());
      return "done";
    },
    async place(round, day, signupId, slot, source) {
      if (state.appointments.some((held) => held.round === round && held.day === day && held.slot === slot && held.signupId !== signupId)) return "slotTaken";
      state.appointments = [...state.appointments.filter((held) => !(held.round === round && held.day === day && held.signupId === signupId)), { round, day, slot, signupId, source }];
      return "ok";
    },
    async swap(round, day, firstId, secondId) {
      const of = (id: string) => state.appointments.find((held) => held.round === round && held.day === day && held.signupId === id);
      const first = of(firstId);
      const second = of(secondId);
      if (!first || !second) return false;
      [first.slot, second.slot] = [second.slot, first.slot];
      first.source = "moderator";
      second.source = "moderator";
      return true;
    },
    async unplace(signupId, days) {
      state.appointments = state.appointments.filter((held) => held.signupId !== signupId || (days !== undefined && !days.includes(held.day)));
    },
    async clearRoster(round, day) {
      state.appointments = state.appointments.filter((held) => !(held.round === round && held.day === day));
      state.assigned.delete(`${round}:${day}`);
      state.published.delete(`${round}:${day}`);
    },
  };
}
