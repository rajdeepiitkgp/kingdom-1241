// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { ScoringDay } from "@/lib/kvk/prep";
import type { Appointment, AppointmentSource } from "./assign";
import type { Amounts, MinistrySettings, Signup, SlotChoice } from "./ministry";

/** A sign-up as the store holds it: with the hash of the key of the browser that may change it. */
export interface StoredSignup extends Signup {
  deviceHash: string | null;
}

export interface NewSignup {
  round: string;
  governorId: string;
  gameName: string;
  allianceTag: string | null;
  verified: boolean;
  power: number | null;
  amounts: Amounts;
  slots: SlotChoice;
  locale: string;
  deviceHash: string | null;
}

export type SignupPatch = Partial<Pick<StoredSignup, "gameName" | "allianceTag" | "verified" | "power" | "amounts" | "slots" | "disabled" | "locale" | "deviceHash">>;

/** A round's appointments and the buff days whose assignment has run (the day's roster is shown from then on). */
export interface RoundRoster {
  appointments: Appointment[];
  /** Per assigned day, when its assignment last ran (ISO). */
  assignedAt: Partial<Record<ScoringDay, string>>;
  /** False before migration 0027: no roster anywhere, the sign-ups work as before. */
  available: boolean;
}

export const NO_ROSTER: RoundRoster = { appointments: [], assignedAt: {}, available: false };

/** `skipped`: the run at the deadline found the day assigned already. `clash`: a free appointment was taken at the same moment; run again. */
export type AssignOutcome = "done" | "skipped" | "clash" | "unavailable";

/** Storage of the ministry sign-ups and the rounds' settings. Methods throw on a database problem; the callers decide what the page says. */
export interface MinistryStore {
  settings(): Promise<MinistrySettings>;
  saveSettings(value: { rounds: MinistrySettings }): Promise<void>;
  /** A round's sign-ups, oldest first. */
  list(round: string): Promise<StoredSignup[]>;
  count(round: string): Promise<number>;
  get(id: string): Promise<StoredSignup | null>;
  byGovernor(round: string, governorId: string): Promise<StoredSignup | null>;
  byDevice(round: string, deviceHash: string): Promise<StoredSignup[]>;
  /** The new row, or "duplicate" when the round already has that Governor ID. */
  insert(row: NewSignup): Promise<StoredSignup | "duplicate">;
  /** The row after the change, or null when it is gone. */
  update(id: string, patch: SignupPatch): Promise<StoredSignup | null>;
  remove(id: string): Promise<boolean>;
  /** Deletes every sign-up of a round with its appointments and the days' "assigned" marks (a clean start after a test); how many sign-ups went. */
  removeRound(round: string): Promise<number>;
  roster(round: string): Promise<RoundRoster>;
  /** Replaces the day's `auto` appointments with `rows` and marks the day assigned, all or nothing. */
  assign(round: string, day: ScoringDay, rows: ReadonlyArray<{ signupId: string; slot: number }>, first: boolean): Promise<AssignOutcome>;
  /** Puts a player into a slot (moving them when they had another one that day); `slotTaken` when someone else holds it. */
  place(round: string, day: ScoringDay, signupId: string, slot: number, source: AppointmentSource): Promise<"ok" | "slotTaken">;
  /** Two players of a day trade their slots (both count as placed by hand); false when one of them holds none any more. */
  swap(round: string, day: ScoringDay, firstId: string, secondId: string): Promise<boolean>;
  /** Takes a player's appointments away: of one day, of some days, or all of them. */
  unplace(signupId: string, days?: readonly ScoringDay[]): Promise<void>;
  /** Back to "not assigned": the day's appointments and its mark go (sign-ups were opened again). */
  clearRoster(round: string, day: ScoringDay): Promise<void>;
}
