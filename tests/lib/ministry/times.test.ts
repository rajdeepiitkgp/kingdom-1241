// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import type { PrepSchedule } from "@/lib/kvk/prep";
import { sectionsFor, type SlotChoice } from "@/lib/ministry/ministry";
import { type BuffTimes, changedDays, moveToken, nextTimes, parseBuffTimes, planMove, slotsFromTimes, timesFromSlots, timesOf } from "@/lib/ministry/times";

const SPLIT: PrepSchedule = { construction: 1, research: 2 };
const SWAPPED: PrepSchedule = { construction: 2, research: 1 };
const MERGED: PrepSchedule = { construction: 1, research: 1 };
const FRIDAY: PrepSchedule = { construction: 5, research: 2 };

/** A round's entries after the council moved its days, as the store would hold them. */
function move(entries: Array<{ id: string; times: BuffTimes | null; slots: SlotChoice }>, from: PrepSchedule, to: PrepSchedule) {
  const plan = planMove(entries, sectionsFor(from), sectionsFor(to));
  return { plan, entries: plan.entries.map(({ id, slots, times }) => ({ id, slots, times })) };
}

describe("times per buff", () => {
  it("reads a stored value tolerantly", () => {
    expect(parseBuffTimes(null)).toBeNull();
    expect(parseBuffTimes([1])).toBeNull();
    expect(parseBuffTimes({ construction: [3, 3, 2, 99], research: "x", nonsense: [1], training: [] })).toEqual({ construction: [2, 3] });
  });

  it("gives every buff of a day that day's times, and a shared day both buffs' times together", () => {
    expect(timesFromSlots({ 1: [4, 5], 2: [20], 4: [0] }, sectionsFor(SPLIT))).toEqual({ construction: [4, 5], research: [20], training: [0] });
    expect(timesFromSlots({ 1: [4, 5] }, sectionsFor(MERGED))).toEqual({ construction: [4, 5], research: [4, 5] });
    expect(slotsFromTimes({ construction: [4, 5], research: [20, 5] }, sectionsFor(MERGED))).toEqual({ 1: [4, 5, 20] });
    expect(slotsFromTimes({ construction: [4], training: [9] }, sectionsFor(SPLIT))).toEqual({ 1: [4], 4: [9] });
  });

  it("trusts stored times only while they give the entry's times per day", () => {
    const sections = sectionsFor(SPLIT);
    // An entry from before the times were kept.
    expect(timesOf({ times: null, slots: { 1: [4], 2: [8] } }, sections)).toEqual({ construction: [4], research: [8] });
    // Stored and in step.
    expect(timesOf({ times: { construction: [4], research: [8] }, slots: { 1: [4], 2: [8] } }, sections)).toEqual({ construction: [4], research: [8] });
    // An older deploy saved new times per day and left the others behind: the days win.
    expect(timesOf({ times: { construction: [4], research: [8] }, slots: { 1: [30] } }, sections)).toEqual({ construction: [30] });
  });

  it("names the days that change hands", () => {
    expect(changedDays(sectionsFor(SPLIT), sectionsFor(SPLIT))).toEqual([]);
    expect(changedDays(sectionsFor(SPLIT), sectionsFor(SWAPPED))).toEqual([1, 2]);
    expect(changedDays(sectionsFor(SPLIT), sectionsFor(MERGED))).toEqual([1, 2]);
    expect(changedDays(sectionsFor(SPLIT), sectionsFor(FRIDAY))).toEqual([1, 5]);
    expect(moveToken(SWAPPED)).toBe("2-1");
  });
});

describe("the council moves the buff days", () => {
  const both = { id: "both", times: null, slots: { 1: [4, 5], 2: [40], 4: [10] } };
  const onlyConstruction = { id: "c", times: null, slots: { 1: [6] } };
  const onlyResearch = { id: "r", times: null, slots: { 2: [30, 31] } };
  const onlyTraining = { id: "t", times: null, slots: { 4: [2] } };

  it("a swap takes each buff's times to its new day, the same half-hours", () => {
    const { plan, entries } = move([both, onlyConstruction, onlyResearch, onlyTraining], SPLIT, SWAPPED);
    expect(plan.days).toEqual([1, 2]);
    expect(entries[0].slots).toEqual({ 1: [40], 2: [4, 5], 4: [10] });
    // A player who signed up for construction alone stays with construction, on its new day.
    expect(entries[1].slots).toEqual({ 2: [6] });
    expect(entries[2].slots).toEqual({ 1: [30, 31] });
    // Training never moves.
    expect(entries[3]).toEqual({ id: "t", slots: { 4: [2] }, times: { training: [2] } });
    expect(plan.entries.map((entry) => entry.moved)).toEqual([true, true, true, false]);
    expect(plan.moved).toBe(3);
  });

  it("a move to Day 5 works like any other", () => {
    const { plan, entries } = move([both, onlyResearch], SPLIT, FRIDAY);
    expect(plan.days).toEqual([1, 5]);
    expect(entries[0].slots).toEqual({ 2: [40], 4: [10], 5: [4, 5] });
    expect(plan.entries.map((entry) => entry.moved)).toEqual([true, false]);
  });

  it("a shared day takes both buffs' times, and nobody drops out", () => {
    const { entries } = move([both, onlyConstruction, onlyResearch], SPLIT, MERGED);
    expect(entries[0].slots).toEqual({ 1: [4, 5, 40], 4: [10] });
    expect(entries[1].slots).toEqual({ 1: [6] });
    expect(entries[2].slots).toEqual({ 1: [30, 31] });
    // Each buff still knows its own times.
    expect(entries[0].times).toEqual({ construction: [4, 5], research: [40], training: [10] });
    expect(entries[2].times).toEqual({ research: [30, 31] });
  });

  it("split, shared, split again: everyone is back where they were", () => {
    const start = [both, onlyConstruction, onlyResearch];
    const merged = move(start, SPLIT, MERGED).entries;
    const back = move(merged, MERGED, SPLIT);
    expect(back.entries.map((entry) => entry.slots)).toEqual(start.map((entry) => entry.slots));
    // And any number of times, by way of a swap too.
    const round = move(move(move(back.entries, SPLIT, SWAPPED).entries, SWAPPED, MERGED).entries, MERGED, SPLIT);
    expect(round.entries.map((entry) => entry.slots)).toEqual(start.map((entry) => entry.slots));
  });

  it("shared from the start, then split: the one set of times counts for both buffs", () => {
    const sections = sectionsFor(MERGED);
    const signedUp = { id: "m", slots: { 1: [12, 13] }, times: nextTimes(null, { 1: [12, 13] }, sections) };
    expect(signedUp.times).toEqual({ construction: [12, 13], research: [12, 13] });
    expect(move([signedUp], MERGED, SPLIT).entries[0].slots).toEqual({ 1: [12, 13], 2: [12, 13] });
  });

  it("times changed while the day was shared count for both buffs after a split", () => {
    const merged = move([both], SPLIT, MERGED).entries[0];
    const sections = sectionsFor(MERGED);
    // A save that leaves the times alone (a new amount) keeps each buff's own.
    const sameTimes = { ...merged, times: nextTimes(merged, merged.slots, sections) };
    expect(sameTimes.times).toEqual({ construction: [4, 5], research: [40], training: [10] });
    expect(move([sameTimes], MERGED, SPLIT).entries[0].slots).toEqual(both.slots);
    // New times for the shared day are the player's times for both buffs from then on.
    const picked: SlotChoice = { 1: [20, 21], 4: [10] };
    const changed = { ...merged, slots: picked, times: nextTimes(merged, picked, sections) };
    expect(changed.times).toEqual({ construction: [20, 21], research: [20, 21], training: [10] });
    expect(move([changed], MERGED, SPLIT).entries[0].slots).toEqual({ 1: [20, 21], 2: [20, 21], 4: [10] });
  });

  it("a day the player leaves takes its buffs' times with it", () => {
    const sections = sectionsFor(SPLIT);
    const entry = { slots: both.slots, times: nextTimes(null, both.slots, sections) };
    expect(nextTimes(entry, { 1: [4, 5] }, sections)).toEqual({ construction: [4, 5] });
  });
});
