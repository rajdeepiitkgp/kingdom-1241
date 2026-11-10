// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { Buff } from "@/lib/kvk/prep";
import type { ResourceField } from "@/lib/ministry/ministry";

/**
 * The game icons of the ministry page, by file (the prep page's own maps live
 * in prep-labels.ts next to its string keys; importing those here would pull
 * the whole prep page's strings into this page's slice).
 */
export const BUFF_IMAGES: Record<Buff, string> = { construction: "/items/construction-speedup.webp", research: "/items/research-speedup.webp", training: "/items/troop-training.webp" };
export const BUFF_ICON: Record<Buff, string> = { construction: "🏗️", research: "🔬", training: "⚔️" };
export const RESOURCE_IMAGES: Record<ResourceField, string> = { truegold: "/items/truegold.webp", temperedTruegold: "/items/tempered-truegold.webp", tgDust: "/items/truegold-dust.webp" };
export const RESOURCE_ICON: Record<ResourceField, string> = { truegold: "🪙", temperedTruegold: "🔶", tgDust: "💫" };
