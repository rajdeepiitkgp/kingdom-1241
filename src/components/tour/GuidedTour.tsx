// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { CircleHelp, Volume2, VolumeX, X } from "lucide-react";
import { Component, type ReactNode, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { type Dictionary, format } from "@/lib/i18n/dictionary";
import { cardSide, hasSeen, markSeen, parseSeen, scrollDelta, TOUR_GAP, TOUR_STORAGE_KEY, type Tour, type TourStep } from "@/lib/tour/tour";
import { pickVoice, speechParts, VOICE_STORAGE_KEY } from "@/lib/tour/voice";

/** The tour's own words: from the dictionary on public pages, plain English in the admin area. */
export interface TourLabels {
  open: string;
  new: string;
  start: string;
  hide: string;
  next: string;
  back: string;
  done: string;
  close: string;
  /** With `{n}` and `{total}`. */
  step: string;
  /** The one card shown when none of the tour's parts is on the page (a "?" never does nothing). */
  empty: string;
  /** The speaker that switches reading aloud on and off. */
  voice: string;
}

export const tourLabels = (dict: Dictionary): TourLabels => ({
  open: dict["tour.open"],
  new: dict["tour.new"],
  start: dict["tour.start"],
  hide: dict["tour.hide"],
  next: dict["tour.next"],
  back: dict["tour.back"],
  done: dict["tour.done"],
  close: dict["tour.close"],
  step: dict["tour.step"],
  empty: dict["tour.empty"],
  voice: dict["tour.voice"],
});

const CHANGE_EVENT = "kd1241:tours";
/** What a blocked localStorage couldn't keep: remembered for this page view only, so the line still goes away. */
const unsaved = new Map<string, string>();

function readStored(key: string): string {
  const kept = unsaved.get(key);
  if (kept !== undefined) return kept;
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    unsaved.delete(key);
  } catch {
    unsaved.set(key, value);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const readSeen = () => readStored(TOUR_STORAGE_KEY);
const rememberSeen = (tour: Pick<Tour, "id" | "version">) => store(TOUR_STORAGE_KEY, JSON.stringify(markSeen(parseSeen(readSeen()), tour)));
const readVoiceOn = () => readStored(VOICE_STORAGE_KEY) === "1";

const speech = () => ("speechSynthesis" in window ? window.speechSynthesis : null);

/** Chrome lists its voices a moment after the page loads (older Safari can't announce it, but has them from the start). */
function subscribeVoices(onChange: () => void) {
  const synth = speech();
  if (typeof synth?.addEventListener !== "function") return () => {};
  synth.addEventListener("voiceschanged", onChange);
  return () => synth.removeEventListener("voiceschanged", onChange);
}

/** The voice for the tour's language; null (the speaker stays hidden) without speech, without a voice, or when the browser can't list them. */
function voiceFor(lang: string | undefined): string | null {
  try {
    const synth = speech();
    return synth ? (pickVoice(synth.getVoices(), lang ?? document.documentElement.lang)?.voiceURI ?? null) : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** The first element with this marker that is drawn (not hidden by a breakpoint, a closed fold-out or a hidden branch). */
const find = (target: string) => [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)].find((element) => element.getClientRects().length > 0) ?? null;
const onPage = (target: string) => find(target) !== null;

export interface TourOptions {
  /** Keep the "New here?" line and the solid highlight away (e.g. during a running rally). */
  quiet?: boolean;
  /** Show `labels.open` next to the "?": always (the admin bar has room), or "wide" from tablet width up (next to a page title). */
  showLabel?: boolean | "wide";
  /** The open tour's direction when its page forces one (the English-only admin area under /ar). */
  dir?: "ltr" | "rtl";
  /** The language the steps are read aloud in, when it isn't the page's (the English-only admin area). */
  lang?: string;
}

/**
 * A page's guided tour. `button` is the "?" (place it with the page's own
 * controls; tinted blue, solid while the tour is new to this device), `nudge` the
 * "New here?" line (null once opened or hidden, and while `quiet`), `overlay`
 * the open tour (render it anywhere: it goes to the body). Nothing opens by
 * itself, so a shared link always lands on the work.
 */
export function useGuidedTour(
  tour: Pick<Tour, "id" | "version">,
  steps: readonly TourStep[],
  labels: TourLabels,
  { quiet = false, showLabel = false, dir, lang }: TourOptions = {},
): { button: ReactNode; nudge: ReactNode; overlay: ReactNode } {
  // Null until hydrated: the server can't know what this device has seen, so nothing is highlighted yet.
  const raw = useSyncExternalStore(subscribe, readSeen, () => null);
  const fresh = raw !== null && !quiet && !hasSeen(parseSeen(raw), tour);
  const [open, setOpen] = useState<TourStep[] | null>(null);
  const opener = useRef<HTMLButtonElement>(null);

  function start() {
    rememberSeen(tour);
    const shown = steps.filter((step) => step.target === null || onPage(step.target));
    setOpen(shown.length > 0 ? shown : [{ target: null, title: labels.open, body: labels.empty }]);
  }
  function close() {
    setOpen(null);
    opener.current?.focus({ preventScroll: true });
  }

  const button = (
    <button
      ref={opener}
      type="button"
      onClick={start}
      aria-haspopup="dialog"
      aria-label={labels.open}
      title={labels.open}
      // Blue, unlike the page's grey icon buttons, so it is always findable; solid while the tour is new to this device.
      className={clsx(
        "shrink-0 rounded-xl border",
        showLabel ? "inline-flex h-9 items-center gap-1.5 text-sm font-extrabold" : "grid size-9 place-items-center",
        showLabel === "wide" ? "justify-center max-sm:w-9 sm:px-3" : showLabel && "px-3",
        fresh ? "border-primary bg-primary text-primary-ink ring-2 ring-primary/30" : "border-primary/40 bg-primary-soft text-primary hover:border-primary",
      )}
    >
      <CircleHelp className="size-4 shrink-0" aria-hidden />
      {showLabel && <span className={clsx(showLabel === "wide" && "max-sm:hidden")}>{labels.open}</span>}
    </button>
  );
  const nudge = fresh && (
    <p className="flex items-center gap-2 text-sm text-ink-muted">
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{labels.new}</span>{" "}
        <button type="button" className="font-bold text-primary underline" onClick={start}>
          {labels.start}
        </button>
      </span>
      <button
        type="button"
        className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-faint hover:text-ink"
        aria-label={labels.hide}
        title={labels.hide}
        onClick={() => {
          rememberSeen(tour);
          opener.current?.focus({ preventScroll: true });
        }}
      >
        <X className="size-4" aria-hidden />
      </button>
    </p>
  );
  const overlay = open && (
    <TourBoundary onError={close}>
      <TourOverlay steps={open} labels={labels} dir={dir} lang={lang} onClose={close} />
    </TourBoundary>
  );
  return { button, nudge, overlay };
}

/**
 * Whatever goes wrong inside an open tour closes the tour, never the page under
 * it (a rally room mid-countdown): the tour is a helper, the page is the work.
 */
class TourBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The open tour: the page dimmed around the highlighted element, and one card
 * with the step at the bottom of the screen (at the top when the element sits
 * there). Esc, the ×, Done or a tap on the dimmed page ends it; nothing about
 * it is stored, so a reload always brings the plain page back. The speaker
 * (shown when the device has a voice for the language) reads each step aloud;
 * that choice is the one thing kept, for every tour on this device.
 */
function TourOverlay({ steps, labels, dir, lang, onClose }: { steps: TourStep[]; labels: TourLabels; dir?: "ltr" | "rtl"; lang?: string; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;
  const root = useRef<HTMLDivElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const voiceOn = useSyncExternalStore(subscribe, readVoiceOn, () => false);
  const voiceUri = useSyncExternalStore(subscribeVoices, () => voiceFor(lang), () => null);

  // Each step is read out while the voice is on (opening the tour or a tap starts it, which browsers require);
  // the next step, switching it off or closing the tour stops the one before. The tour's own tag, not the
  // voice's: Android labels its voices "en_US", which Intl refuses. Speech that fails leaves the tour silent, never broken.
  useEffect(() => {
    const synth = speech();
    const voice = voiceOn ? synth?.getVoices().find((v) => v.voiceURI === voiceUri) : undefined;
    if (!synth || !voice) return;
    const tag = lang ?? document.documentElement.lang;
    try {
      for (const text of speechParts(step.title, step.body, tag)) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = tag;
        synth.speak(utterance);
      }
    } catch {
      synth.cancel();
    }
    return () => synth.cancel();
  }, [step, voiceOn, voiceUri, lang]);

  // Placed by hand, not through state: scroll the element into the free band once per step, then follow it
  // every frame while the tour is open, since anything can move it (scrolling, a live room re-rendering,
  // a line above it going away, a translated page reflowing).
  useLayoutEffect(() => {
    const target = () => (step.target ? find(step.target) : null);
    let placed = "";
    const place = () => {
      const [layer, hole, box] = [root.current, spot.current, card.current];
      if (!layer || !hole || !box) return;
      const rect = target()?.getBoundingClientRect();
      const shown = rect !== undefined && rect.width > 0 && rect.height > 0;
      const key = shown ? `${rect.top},${rect.left},${rect.width},${rect.height},${box.offsetHeight},${window.innerHeight}` : "off";
      if (key === placed) return;
      placed = key;
      layer.dataset.spot = shown ? "on" : "off";
      box.dataset.side = shown ? cardSide(rect, window.innerHeight, box.offsetHeight) : "bottom";
      if (!shown) return;
      const pad = 6;
      hole.style.top = `${rect.top - pad}px`;
      hole.style.left = `${rect.left - pad}px`;
      hole.style.width = `${rect.width + 2 * pad}px`;
      hole.style.height = `${rect.height + 2 * pad}px`;
    };
    const element = target();
    if (element && card.current) {
      const header = Math.max(0, document.getElementById("site-header")?.getBoundingClientRect().bottom ?? 0);
      const band = { top: header + TOUR_GAP, bottom: window.innerHeight - card.current.offsetHeight - 2 * TOUR_GAP };
      const delta = scrollDelta(element.getBoundingClientRect(), band);
      if (delta !== 0) window.scrollBy({ top: delta, behavior: "instant" });
    }
    place();
    let frame = requestAnimationFrame(function follow() {
      place();
      frame = requestAnimationFrame(follow);
    });
    return () => cancelAnimationFrame(frame);
  }, [step.target]);

  useEffect(() => {
    primary.current?.focus({ preventScroll: true });
  }, [index]);

  // Esc ends it, the arrow keys page (mirrored when the card reads right to left), Tab stays inside the card.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const rtl = card.current !== null && getComputedStyle(card.current).direction === "rtl";
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === (rtl ? "ArrowLeft" : "ArrowRight")) {
        setIndex((i) => Math.min(i + 1, steps.length - 1));
      } else if (event.key === (rtl ? "ArrowRight" : "ArrowLeft")) {
        setIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === "Tab" && card.current) {
        const items = [...card.current.querySelectorAll<HTMLElement>("button")];
        const [first, end, at] = [items[0], items.at(-1), document.activeElement];
        if (!card.current.contains(at) || (!event.shiftKey && at === end)) {
          event.preventDefault();
          first?.focus();
        } else if (event.shiftKey && at === first) {
          event.preventDefault();
          end?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);

  return createPortal(
    <div ref={root} className="group fixed inset-0 z-50" dir={dir}>
      {/* The dimmed page: the highlight's spread shadow dims around the element, this layer when there is none. */}
      <div className="absolute inset-0 bg-black/60 group-data-[spot=on]:bg-transparent" onClick={onClose} aria-hidden />
      <div ref={spot} className="tour-spot pointer-events-none fixed hidden rounded-2xl group-data-[spot=on]:block" aria-hidden />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="card fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] mx-auto max-h-[45vh] max-w-md overflow-y-auto p-4 data-[side=top]:top-4 data-[side=top]:bottom-auto md:p-5"
      >
        {/* Built afresh for every step: a browser translating the page swaps text nodes for its own, and an in-place update would go unseen. */}
        <div key={index}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {steps.length > 1 && <p className="text-xs font-bold tracking-wider text-ink-faint uppercase">{format(labels.step, { n: index + 1, total: steps.length })}</p>}
              <h2 id="tour-title" className={clsx("text-lg font-extrabold wrap-break-word text-ink", steps.length > 1 && "mt-0.5")}>
                {step.title}
              </h2>
            </div>
            <div className="-me-1 -mt-1 flex shrink-0">
              {voiceUri !== null && (
                <button
                  type="button"
                  onClick={() => store(VOICE_STORAGE_KEY, voiceOn ? "0" : "1")}
                  aria-pressed={voiceOn}
                  aria-label={labels.voice}
                  title={labels.voice}
                  className={clsx("grid size-9 place-items-center rounded-xl", voiceOn ? "bg-primary-soft text-primary" : "text-ink-faint hover:text-ink")}
                >
                  {voiceOn ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
                </button>
              )}
              <button type="button" onClick={onClose} aria-label={labels.close} title={labels.close} className="grid size-9 place-items-center rounded-xl text-ink-faint hover:text-ink">
                <X className="size-5" aria-hidden />
              </button>
            </div>
          </div>
          <p id="tour-body" className="mt-2 text-sm text-ink-muted">
            {step.body}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {index > 0 && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setIndex(index - 1)}>
                {labels.back}
              </button>
            )}
            <button ref={primary} type="button" className="btn-primary btn-sm" onClick={() => (last ? onClose() : setIndex(index + 1))}>
              {last ? labels.done : labels.next}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
