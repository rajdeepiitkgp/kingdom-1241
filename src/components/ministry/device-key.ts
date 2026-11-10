// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * This browser's key for its ministry sign-ups: random, made here, kept in
 * localStorage and sent only with the browser's own sign-ups (the server
 * stores its hash). Whoever holds it may change those entries. Where storage
 * is blocked the key lives for this visit only, so a sign-up still works and
 * a later change goes through a moderator.
 */

const STORAGE_KEY = "kd1241_ministry_key";
const CHANGED = "kd1241:ministry-key";
let visitKey: string | null = null;

function randomKey(): string | null {
  try {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

function read(): string | null {
  if (visitKey) return visitKey;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && /^[0-9a-f]{32,64}$/.test(stored)) visitKey = stored;
  } catch {
    // Storage blocked: the visit's own key (made in the effect) stands in.
  }
  return visitKey;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

/** The key, or null on the server, until hydrated, and where the browser can't make one. */
export function useDeviceKey(): string | null {
  const key = useSyncExternalStore(subscribe, read, () => null);
  useEffect(() => {
    if (read()) return;
    const made = randomKey();
    if (!made) return;
    visitKey = made;
    try {
      window.localStorage.setItem(STORAGE_KEY, made);
    } catch {
      // Private mode: the key lasts for this visit.
    }
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return key;
}
