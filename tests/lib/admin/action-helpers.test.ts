import { describe, expect, it, vi } from "vitest";
import { denied, failed, INVALID_FIELDS, invalid, SAVE_FAILED, SESSION_ENDED } from "@/lib/admin/action-helpers";
import type { Logger } from "@/lib/log";

function fakeLogger(): Logger & { errors: unknown[][] } {
  const errors: unknown[][] = [];
  const noop = () => {};
  const log: Logger & { errors: unknown[][] } = { errors, debug: noop, info: noop, warn: noop, error: (...args) => void errors.push(args), child: () => log };
  return log;
}

describe("action replies", () => {
  it("tell a signed-out session apart from a missing role", () => {
    expect(denied("signed_out")).toEqual({ status: "error", message: SESSION_ENDED });
    expect(denied("forbidden").message).toMatch(/permission/);
    expect(denied("forbidden", "Only administrators can manage users.").message).toBe("Only administrators can manage users.");
  });

  it("carry the field errors with the standard or a specific message", () => {
    expect(invalid({ slug: "taken" })).toEqual({ status: "error", errors: { slug: "taken" }, message: INVALID_FIELDS });
    expect(invalid({ gameName: "too long" }, "too long").message).toBe("too long");
  });

  it("log the cause of a failed write but never show it to the admin", () => {
    const log = fakeLogger();
    const state = failed(log, "Saving the plan", { message: 'duplicate key value violates unique constraint "kvk_plans_slug_key"', code: "23505" });
    expect(state).toEqual({ status: "error", message: SAVE_FAILED });
    expect(log.errors).toEqual([["Saving the plan failed", { error: 'duplicate key value violates unique constraint "kvk_plans_slug_key"', code: "23505" }]]);
    expect(failed(log, "Reordering", { message: "x" }, "The row could not be moved.").message).toBe("The row could not be moved.");
    vi.restoreAllMocks();
  });
});
