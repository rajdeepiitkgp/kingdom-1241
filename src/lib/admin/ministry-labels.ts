import type { Buff } from "@/lib/kvk/prep";
import type { ResourceField, Section } from "@/lib/ministry/ministry";

/** The buffs' names on the admin ministry page (English, like the rest of the admin area); shared by its server page and client forms. */
export const BUFF_NAME: Record<Buff, string> = { construction: "Construction", research: "Research", training: "Training" };

/** "Construction + Research" for a day both buffs share. */
export const sectionName = (section: Section): string => section.buffs.map((buff) => BUFF_NAME[buff]).join(" + ");

export const RESOURCE_NAME: Record<ResourceField, string> = { truegold: "Truegold", temperedTruegold: "Tempered Truegold", tgDust: "Truegold Dust" };
