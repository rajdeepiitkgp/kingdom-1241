import type { SiteSettings } from "@/lib/data/types";
import { NO_TRANSFER_TERMS } from "@/lib/transfers/terms";

export const SEED_SETTINGS: SiteSettings = {
  kingdomNumber: 1241,
  kingdomName: { en: "Kingdom 1241" },
  tagline: {
    en: "Rules, events, guides and tools for every governor of Kingshot Kingdom 1241.",
  },
  dailyResetUtcHour: 0,
  discordInviteUrl: null,
  transferContact: {
    en: "<p>Ask an R4 or R5 of any alliance in the kingdom.</p>",
  },
  transfersOpen: false,
  // Placeholder (rich text, HTML): the admins write the real terms (Cockpit → Discord & transfers) before they open transfers.
  transferInfo: {
    en: "<p>Placeholder: anything else players should know before they move, such as how many slots there are.</p>",
  },
  // The game's numbers for each window; the admins fill them in.
  transferTerms: NO_TRANSFER_TERMS,
  transferDiscordUrl: null,
  createdBy: "Rudy",
};
