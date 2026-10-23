import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger, requestId } from "@/lib/log";

describe("logger", () => {
  const env = { ...process.env };
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("writes one JSON line per event with the scope, message and fields", () => {
    process.env.LOG_FORMAT = "json";
    process.env.LOG_LEVEL = "info";
    createLogger("data", { reqId: "abc" }).info("Loaded", { table: "events", ms: 12 });
    const line = vi.mocked(console.info).mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({ level: "info", scope: "data", msg: "Loaded", reqId: "abc", table: "events", ms: 12 });
    expect(typeof parsed.time).toBe("string");
  });

  it("serialises errors instead of printing {}", () => {
    process.env.LOG_FORMAT = "json";
    createLogger("x").error("Boom", { error: new TypeError("bad input") });
    const parsed = JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string);
    expect(parsed.error).toMatchObject({ name: "TypeError", message: "bad input" });
  });

  it("respects LOG_LEVEL and child fields", () => {
    process.env.LOG_FORMAT = "json";
    process.env.LOG_LEVEL = "error";
    const log = createLogger("x").child({ reqId: "r1" });
    log.info("ignored");
    log.error("kept");
    expect(console.info).not.toHaveBeenCalled();
    expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string)).toMatchObject({ reqId: "r1", msg: "kept" });
  });

  it("pretty-prints in development", () => {
    process.env.LOG_FORMAT = "pretty";
    process.env.LOG_LEVEL = "debug";
    createLogger("kvk").info("Unlocked", { plan: "oct" });
    const line = (vi.mocked(console.info).mock.calls[0][0] as string).replace(/\x1b\[[0-9;]*m/g, "");
    expect(line).toContain("INFO");
    expect(line).toContain("[kvk]");
    expect(line).toContain("plan=oct");
  });
});

describe("requestId", () => {
  it("prefers the incoming request id, then Vercel's, then generates a short one", () => {
    expect(requestId({ headers: new Headers({ "x-request-id": "given" }) })).toBe("given");
    expect(requestId({ headers: new Headers({ "x-vercel-id": "fra1::abc" }) })).toBe("fra1::abc");
    expect(requestId({ headers: new Headers() })).toMatch(/^[0-9a-f-]{8}$/);
    expect(requestId(new Headers({ "x-request-id": "direct" }))).toBe("direct");
    // Next's ReadonlyHeaders adapter: a Headers-like object that ALSO carries a raw `headers` map.
    const adapter = Object.assign(new Headers({ "x-request-id": "adapter" }), { headers: { "x-request-id": "adapter" } });
    expect(requestId(adapter as unknown as Headers)).toBe("adapter");
    expect(requestId({ headers: { get: () => null } })).toMatch(/^[0-9a-f-]{8}$/);
    expect(requestId()).toMatch(/^[0-9a-f-]{8}$/);
  });
});
