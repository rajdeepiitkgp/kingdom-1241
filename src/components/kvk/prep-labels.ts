import type { UiKey } from "@/content/seed/ui-strings";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import {
  KVK_SATURDAY,
  type PrepDay,
  type PrepItemId,
  type PrepMark,
  type PrepPhase,
  type PrepPoints,
  type PrepTipId,
  type SaveItemId,
  type ScoringDay,
} from "@/lib/kvk/prep";
import { pad2 } from "@/lib/time";

/** Words and stickers of the KvK prep page, shared by the page and the Home card (no React, no clock). */

export const DAY_ICON: Record<PrepDay, string> = { 0: "👀", 1: "🏗️", 2: "🎰", 3: "🐶", 4: "⚔️", 5: "🏁" };

/**
 * Item pictures (128px WebP in `public/items`, from kingshotdata.com,
 * kingshot.net, kingshotwiki.com and the g2384/Kingshot-Data repository); the
 * other items keep their emoji.
 */
export const ITEM_IMAGES: Partial<Record<PrepItemId, string>> = {
  intel: "/items/watchtower.webp",
  gathering: "/items/wood.webp",
  truegold: "/items/truegold.webp",
  temperedTruegold: "/items/tempered-truegold.webp",
  construction: "/items/construction-speedup.webp",
  tgDust: "/items/truegold-dust.webp",
  research: "/items/research-speedup.webp",
  emblem: "/items/master-emblem.webp",
  manuscript: "/items/masters-manuscript.webp",
  roulette: "/items/hero-roulette.webp",
  shards: "/items/hero-shard.webp",
  pets: "/items/taming-mark.webp",
  troops: "/items/troop-training.webp",
  charms: "/items/governor-charm.webp",
  gear: "/items/governor-gear.webp",
  widgets: "/items/widget.webp",
  hammers: "/items/forgehammer.webp",
  mithril: "/items/mithril.webp",
};
export const SAVE_IMAGES: Partial<Record<SaveItemId, string>> = {
  manuscripts: ITEM_IMAGES.manuscript,
  emblems: ITEM_IMAGES.emblem,
  speedups: ITEM_IMAGES.construction,
  gems: "/items/gem.webp",
  truegold: ITEM_IMAGES.truegold,
  shards: ITEM_IMAGES.shards,
  widgets: ITEM_IMAGES.widgets,
  pets: ITEM_IMAGES.pets,
  governor: ITEM_IMAGES.gear,
  hammers: ITEM_IMAGES.hammers,
};
/** Tips with a picture instead of the ❗. */
export const TIP_IMAGES: Partial<Record<PrepTipId, string>> = {
  intelOpen: ITEM_IMAGES.intel,
  bisonSave: "/items/bison.webp",
  warAcademy: "/items/war-academy.webp",
  shield: "/items/shield.webp",
  homeCoords: "/items/teleporter.webp",
};
export const MASTER_PAN_IMAGE = "/items/master-pan.webp";
export const KVK_EVENT_IMAGE = "/items/kingdom-of-power.webp";
export const CALENDAR_IMAGE = "/items/calendar.webp";
const SHIELD_IMAGE = "/items/shield.webp";
/** Each day's sticker: an item that day is about (the emoji in DAY_ICON is the fallback). */
export const DAY_IMAGES: Record<PrepDay, string> = {
  0: "/items/watchtower.webp",
  1: "/items/construction-speedup.webp",
  2: "/items/hero-roulette.webp",
  3: "/items/taming-mark.webp",
  4: "/items/troop-training.webp",
  5: "/items/governor-gear.webp",
};
/** The council's template legend: ✅ best · 🆗 ok · ⚠️ wait · 🚫 don't. */
export const MARK_ICON: Record<PrepMark, string> = { best: "✅", ok: "🆗", wait: "⚠️", no: "🚫" };

export function dayLabel(day: PrepDay, dict: Dictionary): string {
  return format(dict["prep.day"], { n: day });
}

/** The second name some days carry in the game ("Research" is "Basic Skills Up"), shown under the title. */
const THEME_ALT: Partial<Record<PrepDay, UiKey>> = { 2: "prep.themeAlt.2", 4: "prep.themeAlt.4" };

export function themeAlt(day: PrepDay, dict: Dictionary): string | null {
  const key = THEME_ALT[day];
  return key ? dict[key] : null;
}

const hour = (h: number) => `${pad2(h)}:00`;

/** The fixed Saturday times as the tips show them (the same every round, so no clock needed). */
export const SATURDAY = {
  invasion: `${hour(KVK_SATURDAY.invasionHour)} UTC`,
  battle: `${hour(KVK_SATURDAY.battleStartHour)}–${hour(KVK_SATURDAY.battleEndHour)} UTC`,
  shieldFrom: hour(KVK_SATURDAY.invasionHour),
  shieldTo: `${hour(KVK_SATURDAY.shieldEndHour)} UTC`,
};

export function tipText(tip: { id: PrepTipId; day?: ScoringDay }, dict: Dictionary): string {
  return format(dict[`prep.tip.${tip.id}`], { day: tip.day ?? "", time: SATURDAY.battle, from: SATURDAY.shieldFrom, to: SATURDAY.shieldTo });
}

/**
 * An item's points as one line ("30 pts per minute of speedup (1 h = 1,800
 * pts)"), numbers grouped the visitor's way but always in Latin digits, like
 * the rest of the site.
 */
export function pointsText(points: PrepPoints, dict: Dictionary, locale: string): string {
  const nf = new Intl.NumberFormat(`${locale}-u-nu-latn`);
  const n = (value: number) => nf.format(value);
  switch (points.kind) {
    case "perMinute":
      return format(dict["prep.points.perMinute"], { n: n(points.n), hour: n(points.n * 60) });
    case "perTroop":
      return format(dict["prep.points.perTroop"], { min: n(points.min), max: n(points.max) });
    case "shards":
      return format(dict["prep.points.shards"], { mythic: n(points.mythic), epic: n(points.epic), rare: n(points.rare) });
    case "pets":
      return format(dict["prep.points.pets"], { advanced: n(points.advanced), common: n(points.common), advancement: n(points.advancement) });
    case "gathering":
      return format(dict["prep.points.gathering"], { n: n(points.n), bread: n(points.bread), stone: n(points.stone), iron: n(points.iron) });
    default:
      return format(dict[`prep.points.${points.kind}`], { n: n(points.n) });
  }
}

/**
 * Sticker (picture, emoji fallback), small heading, title and countdown label
 * of the current phase. Before the round and on the get-ready Sunday the
 * countdown runs to Day 1, when prep proper starts.
 */
export function phaseView(phase: PrepPhase, dict: Dictionary): { image: string; icon: string; eyebrow: string; title: string; countdown: string } {
  switch (phase.kind) {
    case "before":
      return { image: CALENDAR_IMAGE, icon: "📅", eyebrow: dict["prep.title"], title: dict["prep.status.next"], countdown: dict["prep.status.prepStartsIn"] };
    case "day":
      return {
        image: DAY_IMAGES[phase.day],
        icon: DAY_ICON[phase.day],
        eyebrow: dayLabel(phase.day, dict),
        title: dict[`prep.theme.${phase.day}`],
        countdown: phase.day === 0 ? dict["prep.status.prepStartsIn"] : dict["time.endsIn"],
      };
    case "invasion":
      return { image: SHIELD_IMAGE, icon: "🛡️", eyebrow: dict["prep.title"], title: dict["prep.status.invasion"], countdown: dict["prep.status.battleIn"] };
    case "battle":
      return { image: KVK_EVENT_IMAGE, icon: "🏰", eyebrow: dict["prep.title"], title: dict["prep.status.battle"], countdown: dict["time.endsIn"] };
    case "afterBattle":
      return { image: SHIELD_IMAGE, icon: "🛡️", eyebrow: dict["prep.title"], title: dict["prep.status.afterBattle"], countdown: dict["prep.status.shieldEndsIn"] };
  }
}
