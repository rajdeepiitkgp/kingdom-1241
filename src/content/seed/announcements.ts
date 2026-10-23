/**
 * Seed announcements. `bodyMarkdown` is converted to HTML when seeding.
 * These are boilerplate — admins replace them from the admin panel (phase 2).
 */
export interface SeedAnnouncement {
  id: string;
  title: string;
  bodyMarkdown: string;
  pinned: boolean;
  publishedAt: string;
  expiresAt: string | null;
}

export const SEED_ANNOUNCEMENTS: SeedAnnouncement[] = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    title: "Welcome to the Kingdom 1241 website",
    bodyMarkdown: `This is the home of **Kingshot Kingdom 1241** on the web. Here you will find the kingdom rules, event times in your own time zone, guides for every event, and handy tools.

The site is available in several languages — use the language switcher in the top bar. Translations are generated automatically and reviewed by players, so if something reads oddly, tell an admin on Discord.

Admins: this text is a placeholder. Edit it from the admin panel.`,
    pinned: true,
    publishedAt: "2026-10-23T10:00:00.000Z",
    expiresAt: null,
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    title: "Event times are shown in your local time",
    bodyMarkdown: `All event times on the **Events** page and on the home page are converted to your device's time zone. The in-game server clock runs on **UTC**, and the daily reset happens at **00:00 UTC** — you can see both at the top of the home page.

Alliance leaders: please double-check the Bear Hunt and Viking Vengeance times for your alliance before each event.`,
    pinned: false,
    publishedAt: "2026-10-22T18:00:00.000Z",
    expiresAt: null,
  },
];
