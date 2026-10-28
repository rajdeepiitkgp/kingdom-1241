// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { Tour } from "@/lib/tour/tour";

/**
 * The admin area's guided tours, one per page, opened from "Page guide" in the
 * admin bar (`AdminGuide`). Written for a moderator or administrator on their
 * first day: where things are, what goes in each field, which link or password
 * goes to whom. English only, like the rest of the admin area. Steps whose
 * element a page doesn't show (Users for moderators, the links of a room that
 * hasn't been created) are left out when the tour starts.
 */

export type AdminPage = "overview" | "plans" | "plan" | "leaders" | "checklist" | "feedback" | "results" | "rallySync" | "users";

export const ADMIN_TOUR_LABELS = {
  open: "Page guide",
  new: "New here?",
  start: "Take the guide to this page",
  hide: "Hide",
  next: "Next",
  back: "Back",
  done: "Done",
  close: "Close the guide",
  step: "Step {n} of {total}",
};

const step = (target: string | null, title: string, body: string) => ({ target, title, body });

export const ADMIN_TOURS: Record<AdminPage, Tour> = {
  overview: {
    id: "admin-overview",
    version: 1,
    steps: [
      step(
        null,
        "Welcome to the admin area",
        "This is the council's tool: battle plans with their leader and commander pages, player feedback and Rally Sync rooms. This guide shows where everything is; every admin page has its own guide for the details.",
      ),
      step(
        "admin-role",
        "Your role",
        "Moderators edit battle plans and their pages, run feedback forms and create Rally Sync rooms. Administrators can also delete plans and give people roles; only the owner appoints administrators.",
      ),
      step(
        "admin-nav-plans",
        "Battle plans",
        "Everything players read for a battle: the plan for all players, the rally-leader page and the commander checklist, each behind its own password. Most of the work happens here.",
      ),
      step("admin-nav-feedback", "Feedback", "The short form players fill in after a battle, and its results: averages, comments, an AI summary and a CSV export."),
      step("admin-nav-rally", "Rally Sync", "Create the rooms that line up rally start times on battle day, and get the links to share."),
      step("admin-nav-users", "Users", "Give people the moderator or administrator role, before or after their first sign-in, and take it away again."),
      step("admin-active-plan", "The active plan", "The plan players see on the KvK page right now; Edit opens it. With no active plan, players see “no plan”."),
      step(
        "admin-profile",
        "Your profile: do this first",
        "Type your in-game name exactly as in Kingshot, pick your alliance and save. It is shown with every change you make, so the council knows who did what.",
      ),
      step("admin-audit", "Recent changes", "The last edits in the admin area, newest first: a quick way to check that a change went through, or to see who to ask about it."),
      step(
        "admin-guide",
        "A guide on every page",
        "Each admin page has its own guide: tap Page guide whenever you're unsure what goes where. A good next step: open Battle plans and take its guide.",
      ),
    ],
  },
  plans: {
    id: "admin-plans",
    version: 1,
    steps: [
      step("plans-new", "New plan", "Starts an empty plan. Usually quicker: Duplicate the last plan below and change the date, the passwords and the details."),
      step("plans-list", "One plan per battle", "Active (green) is the plan players see on the KvK page; only one plan is active at a time. Unpublished plans stay hidden from players."),
      step(
        "plans-actions",
        "The buttons",
        "Edit: the plan for all players. Rally leaders and Checklist: the two other pages of the same battle, each with its own password. Duplicate: a copy for the next battle (rally start times are cleared). Delete (administrators only) removes the plan with all its pages and feedback.",
      ),
      step(
        null,
        "The usual cycle",
        "1. Duplicate the current plan. 2. Edit the copy: date, new passwords, instructions, formations. 3. Update its rally-leader page and checklist. 4. Tick Active on the copy and save: players see it at once. 5. Share each password with its own group.",
      ),
    ],
  },
  plan: {
    id: "admin-plan",
    version: 1,
    steps: [
      step(
        "plan-tabs",
        "Three pages per battle",
        "The battle plan for all players, the rally-leader page and the commander checklist. Each has its own password, so each group sees only its page.",
      ),
      step(
        "plan-lang",
        "Edit in English",
        "Every other language is translated automatically shortly after you save. To fix one translation by hand, pick its language here; your fix stays until the English text changes.",
      ),
      step("plan-status", "Live or not", "Green: this is the active plan and every save reaches players within seconds. Grey: players don't see it yet."),
      step(
        "plan-title",
        "Title and event",
        "A short title players see at the top, e.g. “Castle battle, 8 Nov”. Next to it: castle battle (inside 1241) or KvK; for KvK add the opponent.",
      ),
      step(
        "plan-time",
        "Battle time",
        "Type the start in UTC; players see it in their own time zone. Standard window fills 12:00–17:00 UTC. The end is optional: after it the page says the battle is over.",
      ),
      step("plan-heroes", "Hero requirements", "The minimum hero stars and the top expedition skill level (the skill with the flag icon) for the formations below."),
      step(
        "plan-password",
        "The password",
        "Players need it to open the plan. Tap Suggest for a random six-digit code and use a new one for every battle, different from the leader and checklist pages. Share it only in the alliance chat or Discord. Changing it logs every player out, so change it if it leaks.",
      ),
      step(
        "plan-intro",
        "Introduction",
        "What players read first. **bold**, lists with “- ”. Write {{when}} or {{time}} instead of “tomorrow” or a clock time: everyone sees the battle time in their own words and time zone, so the text never goes stale.",
      ),
      step("plan-flags", "Active and Published", "Active makes this the plan players see and replaces the previous one. Untick Published to keep it hidden while you work on it."),
      step("plan-save", "Save", "Nothing is kept until you save. Discard changes undoes what you typed since the last save."),
      step(
        "plan-rules",
        "Battle-day instructions",
        "Short ✅ Do / ⛔ Don't / ℹ️ Info lines, shown as a checklist above the formations. Add one in the dashed box at the bottom; the arrows change the order.",
      ),
      step(
        "plan-coordinators",
        "Coordinators",
        "Who players listen to on battle day: team [KvK] for the castle rallies or [TMP] for the counter-rallies, in-game name, home alliance and an optional note.",
      ),
      step(
        "plan-formations",
        "Formations",
        "One entry per troop preset players save in the game, up to twelve: side, role, three heroes and the troop percentages. Tap a formation to open it; leave a hero on “Any hero” when players may choose.",
      ),
      step(
        "plan-feedback",
        "Player feedback",
        "The short form players fill in after the battle, behind the plan's password. Choose the questions and how long answers are kept here, tick Open after the battle, and read the answers under Feedback.",
      ),
      step("plan-view", "Check what players see", "Opens the players' page in a new tab. You type the password once, like any player."),
    ],
  },
  leaders: {
    id: "admin-leaders",
    version: 1,
    steps: [
      step("plan-tabs", "Rally-leader page", "The second page of this battle, only for the players who start rallies, with its own password."),
      step(
        "leaders-status",
        "Live or not",
        "Green: leaders can open the page at /kvk/leaders. Otherwise this line says why not: no page yet, not published, or the plan isn't active.",
      ),
      step(
        "leaders-password",
        "The leaders' password",
        "Different from the plan's and the checklist's (the form refuses a repeat). Suggest makes a random code. Send it to the leaders directly, not in the alliance chat. Changing it logs every leader out.",
      ),
      step("leaders-intro", "Instructions", "Shown above the rallies: the plan for the leaders in a few lines. {{when}} and {{time}} show the battle time in each leader's time zone."),
      step("leaders-publish", "Published", "Leaders can open the page while this plan is active. Save the page first: the instructions and rallies appear below once it exists."),
      step(
        "leaders-rules",
        "Leader instructions",
        "Do / Don't / Info lines for every leader, or only the rally leads or the garrison leads: march times, when to start, pets, where to teleport.",
      ),
      step(
        "leaders-rallies",
        "Rallies",
        "One entry per rally: target, side, battle team ([KvK] or [TMP]), the leader's in-game name and home alliance, where to stand, an optional start time (UTC), when to activate pets, heroes and troop ratio. Tap a rally to edit it.",
      ),
      step("plan-view", "Check the leaders' page", "Opens /kvk/leaders in a new tab; it asks for the leaders' password."),
    ],
  },
  checklist: {
    id: "admin-checklist",
    version: 1,
    steps: [
      step("plan-tabs", "Commander checklist", "The third page of this battle, for the battle commander and the coordinators, with its own password."),
      step("checklist-status", "Live or not", "Green: the commander and the coordinators can open it at /kvk/checklist. Otherwise this line says why not."),
      step(
        "checklist-password",
        "Checklist password",
        "Only for the commander and the coordinators, and different from the other two pages. Give it to them in a direct message.",
      ),
      step("checklist-intro", "Commander's brief", "Shown above the checklist: the commander's plan in a few lines."),
      step("checklist-publish", "Published", "The page opens while this plan is active. Save it first: the tasks and lines appear below once it exists."),
      step(
        "checklist-items",
        "Tasks by phase",
        "Everything to do before battle day, on the day before the start, during and after the battle. The commander ticks them off on their own device; ticks aren't shared with anyone.",
      ),
      step("checklist-rules", "Orders and guidelines", "Do / Don't / Info lines: the commander's orders, and the general guidelines for everyone who coordinates."),
      step("plan-view", "Check the page", "Opens /kvk/checklist in a new tab; it asks for the checklist password."),
    ],
  },
  feedback: {
    id: "admin-feedback",
    version: 1,
    steps: [
      step("feedback-list", "One form per battle", "Every plan can have one feedback form; the chips show whether it is open. Only one form is open at a time."),
      step(
        "feedback-actions",
        "Set up and read",
        "Set up feedback (or Settings) opens the form's settings in the plan editor. Results shows the answers once players send them.",
      ),
      step(
        null,
        "Good practice",
        "Open the form right after the battle, while it's fresh. Players reach it from the battle plan with the plan's password, or at /kvk/feedback. Answers are deleted after the retention period, so export them first.",
      ),
    ],
  },
  results: {
    id: "admin-results",
    version: 1,
    steps: [
      step(
        "results-status",
        "At a glance",
        "Open or closed, how many answered, when it closes and when the answers are deleted. Only the owner sees names and Governor IDs.",
      ),
      step("results-export", "Export CSV", "Every answer in a spreadsheet file, without names. Export before the answers are deleted."),
      step(
        "results-ai",
        "AI summary",
        "Translate answers puts the written answers into English: cheap, run it whenever new answers come in. The summary (mood, themes, what to do) is run by the owner only, because each run costs several dollars; everyone can read the last one here.",
      ),
      step("results-summary", "Summary", "Averages on the 0–5 scale and how the answers spread."),
      step("results-responses", "Responses", "Every answer, newest first. Delete removes one answer, e.g. spam."),
      step("results-delete", "Delete all", "Removes every answer now instead of waiting for the retention period. Export first: it can't be undone."),
    ],
  },
  rallySync: {
    id: "admin-rally-sync",
    version: 1,
    steps: [
      step(
        "rs-new",
        "New room",
        "One room per group on battle day: a rally room per attack wave, a counter-rally room for the counter alliance, a garrison room for the defenders. At most three are open at once.",
      ),
      step("rs-title", "Title", "Optional; players see it once they're in, e.g. “Castle, first wave”."),
      step(
        "rs-password",
        "Password",
        "At least six characters; Suggest makes a random code. Players type it with the room ID, or use the invite link instead. Pick a new one for every room, never a battle-plan password.",
      ),
      step(
        "rs-mode",
        "Mode",
        "Rally: our rallies land in the same second. Counter-rally: the counter alliance's launch order. Garrison: refills land between enemy hits. It can't be changed later.",
      ),
      step("rs-wait", "Rally timer", "The in-game rally wait, usually 5:00."),
      step("rs-buffer", "Buffer", "Rally rooms: the seconds the leader with the longest march gets to prepare when the coordinator taps Re-sync. 30 is a good start."),
      step("rs-create", "Create room", "The room ID, password, invite link and coordinator link then show once, right here: copy them straight away."),
      step(
        "rs-links",
        "What to share",
        "Invite link: for the players; it opens the room without the password. Room ID and password: for anyone who types them in. Coordinator link: only for whoever runs the room, never in a chat. Open as coordinator runs the room from this device.",
      ),
      step(
        "rs-rooms",
        "Rooms",
        "Every room with its mode and activity. Open goes in; New coordinator link replaces a lost one (the old one stops working); Destroy closes it at once. A room also closes by itself after 30 minutes with nobody on the page.",
      ),
      step(
        null,
        "Good practice",
        "Create the rooms shortly before the battle, post the invite link only in the alliance's private chat, give the coordinator link to one or two people, and destroy the rooms when the battle is over.",
      ),
    ],
  },
  users: {
    id: "admin-users",
    version: 1,
    steps: [
      step(
        "users-accounts",
        "Accounts",
        "Everyone who has signed in, with the in-game name they set and their Discord handle. Check the handle before giving a role: anyone can type a name, only the handle is theirs.",
      ),
      step(
        "users-role",
        "Roles",
        "Pick a role and Save. Moderator: edits plans and their pages, feedback and Rally Sync. Administrator: also deletes plans and manages users; only the owner appoints administrators. Member: no admin access. Remove deletes the account; they can sign in again, without access.",
      ),
      step(
        "users-grants",
        "Before the first sign-in",
        "Type their Discord username (the handle, not the display name) and the role: they have it the moment they sign in. Demoting someone above also removes their pre-authorisation, so it sticks.",
      ),
      step(
        null,
        "Bringing in a new moderator",
        "1. Pre-authorise their Discord handle as Moderator. 2. They sign in with Discord: the key icon at the top of the site, or Admin sign-in at the bottom of any page on a phone. 3. They set their in-game name on the Overview, then tap Page guide on each page.",
      ),
    ],
  },
};

/** Which admin page a path is (`/en/admin/kvk/<id>/leaders` → "leaders"); null where there is no guide (the login page). */
export function adminPageFor(pathname: string): AdminPage | null {
  const match = /^\/[^/]+\/admin(\/.*)?$/.exec(pathname.replace(/\/+$/, ""));
  if (!match) return null;
  const parts = (match[1] ?? "").split("/").filter(Boolean);
  const [section, id, sub] = parts;
  if (parts.length === 0) return "overview";
  if (section === "kvk") return parts.length === 1 ? "plans" : parts.length === 2 ? "plan" : parts.length === 3 && (sub === "leaders" || sub === "checklist") ? sub : null;
  if (section === "feedback") return parts.length === 1 ? "feedback" : parts.length === 2 && id ? "results" : null;
  if (parts.length === 1 && section === "rally-sync") return "rallySync";
  if (parts.length === 1 && section === "users") return "users";
  return null;
}
