// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { randomUUID } from "node:crypto";
import { nextRound, roundFor, SCORING_DAYS } from "@/lib/kvk/prep";
import { roundKey } from "@/lib/kvk/prep-schedule";
import { type Amounts, type MinistrySettings, NO_AMOUNTS, pickBlocks, type SlotChoice } from "./ministry";
import type { MinistryStore, StoredSignup } from "./store-types";

/**
 * The ministry sign-ups without a database, for reviewing the pages locally
 * and for the browser tests (MINISTRY_STORE=memory; ignored on Vercel).
 * Everything lives in this server process and vanishes on restart.
 *
 * The round after the current one is open from the start, with the default
 * deadlines (always weeks ahead, so the tests see the same page on any date),
 * and holds a handful of demo players so the moderators' list has something
 * to show.
 */

interface Memory {
  settings: MinistrySettings;
  signups: Map<string, StoredSignup>;
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
      settings: { [round]: { open: true, deadlines: {} } },
      signups: new Map(demoSignups(round).map((signup) => [signup.id, signup])),
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
      return state.signups.delete(id);
    },
  };
}
