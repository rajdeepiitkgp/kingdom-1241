import { type SoundCue, soundCues } from "./timing";

/**
 * The countdown sounds of a leader's own rally (browser, Web Audio; no sound
 * files). Cues are booked ahead on the audio clock rather than fired by timers,
 * so a laptop tab in the background (where timers run late) still beeps on the
 * second. Browsers allow sound only after a tap on the page: `unlock()` runs in
 * that tap.
 */

/** Cues further ahead than this are booked on a later sync (the page syncs at least once a minute even in the background). */
const LOOKAHEAD_MS = 130_000;

export class CuePlayer {
  private context: AudioContext | null = null;
  private key = "";
  private booked = new Map<number, OscillatorNode[]>();

  get unlocked(): boolean {
    return this.context?.state === "running";
  }

  /** Call from a tap: creates or resumes the audio context. */
  unlock(): void {
    try {
      this.context ??= new AudioContext();
      void this.context.resume();
    } catch {
      // No Web Audio (very old browser): the page stays silent.
    }
  }

  /**
   * Books the cues of `start` that lie ahead on the corrected clock (device
   * clock + `offsetMs`; a new start or a clock correction rebooks everything).
   * `start` null (no hit time, or sound off) cancels all.
   */
  sync(start: number | null, offsetMs: number): void {
    const now = Date.now() + offsetMs;
    const key = start === null ? "" : `${start}:${Math.round(offsetMs / 50)}`;
    if (key !== this.key) {
      this.cancel();
      this.key = key;
    }
    const context = this.context;
    if (start === null || !context || context.state !== "running") return;
    for (const cue of soundCues(start)) {
      const ahead = cue.at - now;
      if (ahead <= 0 || ahead > LOOKAHEAD_MS || this.booked.has(cue.at)) continue;
      this.booked.set(cue.at, this.play(context, cue, context.currentTime + ahead / 1000));
    }
  }

  cancel(): void {
    for (const nodes of this.booked.values()) for (const node of nodes) node.stop();
    this.booked.clear();
  }

  private play(context: AudioContext, cue: SoundCue, at: number): OscillatorNode[] {
    switch (cue.kind) {
      case "chime":
        return [tone(context, at, 660, 0.25, 0.12), tone(context, at + 0.18, 880, 0.3, 0.12)];
      case "tick":
        // 5 … 1: each beep a step higher and louder.
        return [tone(context, at, 600 + cue.step * 120, 0.12, 0.16 + cue.step * 0.06, "triangle")];
      case "go":
        return [tone(context, at, 1175, 0.8, 0.32, "square"), tone(context, at, 587, 0.8, 0.2)];
    }
  }
}

function tone(context: AudioContext, at: number, frequency: number, duration: number, volume: number, type: OscillatorType = "sine"): OscillatorNode {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.05);
  return oscillator;
}
