/**
 * Tiny structured logger (no dependencies, works in Node and Edge).
 *
 *   const log = createLogger("data");
 *   log.info("Loaded plan", { table: "kvk_plans", ms: 12 });
 *   log.error("Supabase failed", { error });
 *
 * Development: one coloured, readable line per event.
 * Production (Vercel): one JSON line per event — the Vercel log viewer and
 * any log drain show `level`, `scope`, `reqId`, … as searchable fields.
 *
 * Env: LOG_LEVEL=debug|info|warn|error (default info in production, debug in
 * development), LOG_FORMAT=pretty|json to override the automatic choice.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** A logger that adds `fields` (e.g. a request id) to every line. */
  child(fields: LogFields): Logger;
}

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const isProduction = process.env.NODE_ENV === "production";

function threshold(): number {
  const configured = process.env.LOG_LEVEL?.trim().toLowerCase() as LogLevel | undefined;
  if (configured && configured in LEVELS) return LEVELS[configured];
  return isProduction ? LEVELS.info : LEVELS.debug;
}

function prettyOutput(): boolean {
  const format = process.env.LOG_FORMAT?.trim().toLowerCase();
  if (format === "pretty") return true;
  if (format === "json") return false;
  return !isProduction;
}

const COLORS: Record<LogLevel, string> = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m" };
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

/** Errors don't JSON.stringify by themselves; keep what helps debugging. */
function serializeError(error: unknown): LogFields {
  if (error instanceof Error) {
    const out: LogFields = { name: error.name, message: error.message };
    if (!isProduction && error.stack) out.stack = error.stack;
    const code = (error as { code?: unknown }).code;
    if (code !== undefined) out.code = code;
    return out;
  }
  if (error && typeof error === "object") {
    // Supabase/PostgREST errors are plain objects with message/code/details.
    const { message, code, details, hint } = error as Record<string, unknown>;
    if (message !== undefined || code !== undefined) return { message, code, details, hint };
  }
  return { message: String(error) };
}

function normalize(fields: LogFields | undefined): LogFields {
  if (!fields) return {};
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    out[key] = key === "error" || value instanceof Error ? serializeError(value) : value;
  }
  return out;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return /\s/.test(value) ? JSON.stringify(value) : value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function emit(level: LogLevel, scope: string, message: string, fields: LogFields) {
  if (LEVELS[level] < threshold()) return;
  const write = level === "error" ? console.error : level === "warn" ? console.warn : level === "info" ? console.info : console.debug;

  if (!prettyOutput()) {
    write(JSON.stringify({ time: new Date().toISOString(), level, scope, msg: message, ...fields }));
    return;
  }

  const time = new Date().toISOString().slice(11, 19);
  const pairs = Object.entries(fields)
    .map(([key, value]) => `${DIM}${key}=${RESET}${formatValue(value)}`)
    .join(" ");
  write(`${DIM}${time}${RESET} ${COLORS[level]}${level.toUpperCase().padEnd(5)}${RESET} ${COLORS.info}[${scope}]${RESET} ${message}${pairs ? ` ${pairs}` : ""}`);
}

export function createLogger(scope: string, base: LogFields = {}): Logger {
  const log = (level: LogLevel) => (message: string, fields?: LogFields) => emit(level, scope, message, { ...base, ...normalize(fields) });
  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    child: (fields) => createLogger(scope, { ...base, ...normalize(fields) }),
  };
}

/**
 * Correlation id for one request: Vercel's own id when present, otherwise a
 * short random one. Returned to the caller as `x-request-id` so a player's
 * screenshot of an error can be matched with the server log.
 */
type HeaderSource = { get(name: string): string | null };

function isHeaderSource(value: unknown): value is HeaderSource {
  return typeof (value as HeaderSource | null)?.get === "function";
}

export function requestId(source?: { headers: HeaderSource } | HeaderSource | null): string {
  // Accepts a Request, a Headers object or Next's ReadonlyHeaders. Detect by
  // capability: Next's headers adapter also has an internal `headers` field,
  // so checking for that property first would pick the wrong object.
  const headers = isHeaderSource(source) ? source : isHeaderSource(source?.headers) ? source.headers : null;
  const given = headers ? (headers.get("x-request-id") ?? headers.get("x-vercel-id")) : null;
  if (given) return given.slice(0, 64);
  return globalThis.crypto.randomUUID().slice(0, 8);
}

/** Milliseconds since `start` (from `performance.now()`), rounded. */
export function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}
