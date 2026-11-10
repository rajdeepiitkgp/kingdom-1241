// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
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
}
