// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.

/**
 * Reading a tour aloud (pure parts, unit-tested). The browser's own speech
 * (Web Speech API) reads each step in the tour's language: no audio files, no
 * service, nothing to pay. Which languages can be heard depends on the voices
 * the device has, so the speaker only shows where one fits. Off until the
 * visitor switches it on, then remembered on this device.
 */

/** localStorage: "1" while this device reads tours aloud. */
export const VOICE_STORAGE_KEY = "kd1241_tour_voice";

/** What choosing needs of a voice (a SpeechSynthesisVoice in the browser). */
export interface VoiceInfo {
  name: string;
  lang: string;
  default: boolean;
}

/** A tag Intl accepts: Android labels its voices "de_DE". */
const bcp47 = (tag: string) => tag.replace(/_/g, "-");
const normal = (tag: string) => bcp47(tag).toLowerCase();
const primary = (tag: string) => normal(tag).split("-")[0];

/**
 * Apple's novelty and character voices (Albert, Bubbles, Grandpa, …). They are
 * listed first and alphabetically, so "the first Korean voice" is Eddy rather
 * than Yuna; they are only chosen when nothing else speaks the language.
 */
const CHARACTER_VOICES = new Set(
  "Albert,Bad News,Bahh,Bells,Boing,Bubbles,Cellos,Eddy,Flo,Fred,Good News,Grandma,Grandpa,Jester,Junior,Kathy,Organ,Ralph,Reed,Rocko,Sandy,Shelley,Superstar,Trinoids,Whisper,Wobble,Zarvox".split(","),
);

/**
 * The voice for a language, or null when the device has none: the device's
 * default voice when it speaks the language, else the same tag ("zh-TW")
 * before the same language ("ar" fits "ar-001"), a plain voice before a
 * character voice, and the device's order after that.
 */
export function pickVoice<V extends VoiceInfo>(voices: readonly V[], lang: string): V | null {
  const score = (voice: V) => (voice.default ? 4 : 0) + (normal(voice.lang) === normal(lang) ? 2 : 0) + (CHARACTER_VOICES.has(voice.name.split(" (")[0]) ? 0 : 1);
  let best: V | null = null;
  for (const voice of voices) {
    if (primary(voice.lang) === primary(lang) && (best === null || score(voice) > score(best))) best = voice;
  }
  return best;
}

/** Emoji (✅, ⛔, ℹ️) would be read out by name. */
const PICTOGRAPHS = /[\p{Extended_Pictographic}\uFE0F]/gu;

function sentences(text: string, lang: string): string[] {
  try {
    return [...new Intl.Segmenter(bcp47(lang), { granularity: "sentence" }).segment(text)].map((s) => s.segment);
  } catch {
    // No Intl.Segmenter (an older browser) or a tag it can't read: the text in one piece.
    return [text];
  }
}

/**
 * What to say for a step: its title, then its body sentence by sentence, since
 * some voices stop part-way through a long utterance.
 */
export function speechParts(title: string, body: string, lang: string): string[] {
  const clean = (text: string) => text.replace(PICTOGRAPHS, "").replace(/\s+/g, " ").trim();
  return [title, ...sentences(body, lang)].map(clean).filter(Boolean);
}
