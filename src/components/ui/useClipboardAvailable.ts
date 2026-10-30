import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const onServer = () => false;
const inBrowser = () => typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";

/**
 * Whether this browser can write to the clipboard: false on the server and
 * while hydrating, so a Copy button appears only where it can work (plain-http
 * pages and some in-app browsers have no clipboard API).
 */
export function useClipboardAvailable(): boolean {
  return useSyncExternalStore(subscribe, inBrowser, onServer);
}
