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

export type AdminPage =
  | "overview"
  | "plans"
  | "plan"
  | "leaders"
  | "checklist"
  | "feedback"
  | "results"
  | "print"
  | "rallySync"
  | "announcements"
  | "announcement"
  | "events"
  | "event"
  | "rules"
  | "ruleTopic"
  | "rule"
  | "guides"
  | "guide"
  | "guideSection"
  | "alliances"
  | "alliance"
  | "transfers"
  | "giftCodes"
  | "users"
  | "settings";

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
  empty: "Nothing on this page to walk through right now.",
  voice: "Read aloud",
};

const step = (target: string | null, title: string, body: string) => ({ target, title, body });

export const ADMIN_TOURS: Record<AdminPage, Tour> = {
  overview: {
    id: "admin-overview",
    version: 5,
    steps: [
      step(
        null,
        "Welcome to the admin area",
        "This is the council's tool: battle plans with their leader and commander pages, player feedback, Rally Sync rooms, the announcements, events and gift codes on Home, the rules and guides pages, and each alliance's page. This guide shows where everything is; every admin page has its own guide for the details.",
      ),
      step(
        "admin-role",
        "Your role",
        "Moderators edit battle plans and their pages, run feedback forms, create Rally Sync rooms and write the announcements, events, rules, guides and alliance pages. Administrators can also delete plans, open or close transfers and give people roles; only the owner appoints administrators.",
      ),
      step(
        "admin-nav-menu",
        "Cockpit",
        "Every admin page, in groups: the battle tools, the website's texts, and people and settings. It always names the page you are on; tap it to go elsewhere.",
      ),
      step(
        "admin-nav-plans",
        "Battle plans",
        "Everything players read for a battle: the plan for all players, the rally-leader page and the commander checklist, each behind its own password. Most of the work happens here.",
      ),
      step("admin-nav-feedback", "Feedback", "The short form players fill in after a battle, and its results: averages, comments, an AI summary and a CSV export."),
      step("admin-nav-rally", "Rally Sync", "Create the rooms that line up rally start times on battle day, and get the links to share."),
      step("admin-nav-announcements", "Announcements", "The news on Home. Write it in English, with images if you like; players read it in their language a minute later."),
      step("admin-nav-events", "Events", "The event calendar on Home and the events page: when each event runs, or for events each alliance times itself, which days."),
      step("admin-nav-rules", "Rules", "The kingdom's rules, in topics that are the tabs of the rules page. Players read them in their language a minute after you save."),
      step("admin-nav-guides", "Guides", "How 1241 plays each event: a text for everyone, plus a section for each alliance that plays it its own way."),
      step("admin-nav-alliances", "Alliance pages", "Each alliance's own page: a few lines from its leaders, its requirements, languages and Discord invite. The numbers come from MightPulse by themselves."),
      step("admin-nav-gift-codes", "Gift codes", "The codes on Home. They come by themselves from kingshot.net every hour; add one here when players have it first."),
      step(
        "admin-nav-transfers",
        "Discord & transfers",
        "Administrators only: the kingdom's Discord invite on Home, whether the kingdom takes transfers, and what players see about moving here.",
      ),
      step("admin-nav-users", "Users", "Give people the moderator or administrator role, before or after their first sign-in, and take it away again."),
      step("admin-nav-settings", "Settings", "Only the owner has this: Rally Sync limits, the alliances on Home, languages and the site's other switches."),
      step("admin-usage", "Usage (only you see this)", "Whether anything about the site's free plans needs you: green, amber or red, with the names of what to look at. Tap it for the Usage tab."),
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
      step(
        "plan-flags",
        "Active and Published",
        "Active makes this the plan players see and replaces the previous one. While a battle's feedback form is open, its plan stays active: close that form before activating the next plan. Untick Published to keep it hidden while you work on it.",
      ),
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
        "The short form players fill in after the battle, behind the plan's password. Choose the questions and how long answers are kept here, tick Open after the battle (the plan must be active, and it stays active until you untick Open), and read the answers under Feedback.",
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
    version: 2,
    steps: [
      step(
        "results-status",
        "At a glance",
        "Open or closed, how many answered, when it closes and when the answers are deleted. Only the owner sees names and Governor IDs.",
      ),
      step(
        "results-names",
        "Hide names",
        "Takes the names and Governor IDs off this page, its pages and the print view, e.g. for a screenshot. Show names brings them back.",
      ),
      step("results-print", "Print", "Every answer on one page, laid out for paper or a PDF (light or dark), with the summary on top."),
      step("results-export", "Export CSV", "Every answer in a spreadsheet file, without names. Export before the answers are deleted."),
      step(
        "results-ai",
        "AI summary",
        "Translate answers puts the written answers into English: cheap, run it whenever new answers come in. The summary (mood, themes, what to do) is run by the owner only, once the form has closed: one request reads every answer. Everyone can read the last one here.",
      ),
      step("results-summary", "Summary", "Averages on the 0–5 scale and how the answers spread."),
      step("results-responses", "Responses", "Every answer, newest first. Delete removes one answer, e.g. spam."),
      step(
        "results-pages",
        "More answers",
        "Newer and Older move through the pages; Per page shows 5, 15 or 25 answers at a time. The summary above always counts every answer.",
      ),
      step("results-delete", "Delete all", "Removes every answer now instead of waiting for the retention period. Export first: it can't be undone."),
    ],
  },
  print: {
    id: "admin-feedback-print",
    version: 1,
    steps: [
      step(
        "print-sheet",
        "The printout",
        "The summary, the AI summary if there is one, then every answer, newest first. Only this part goes on paper: the bars and buttons stay off.",
      ),
      step(
        "print-names",
        "Hide names",
        "Leaves the names and Governor IDs out of the printout. Hide them before you share the file outside the council.",
      ),
      step(
        "print-paper",
        "Paper",
        "Light is white paper, for a printer. Dark gives a PDF that is easier to read on a phone at night. It changes only the printout, not this page.",
      ),
      step(
        "print-button",
        "Print or save as PDF",
        "Opens the print dialog. To get a file, pick Save as PDF as the printer. On a phone the dialog may sit behind Share, then Print. Inside an app's own browser (Discord) nothing may open: open the page in Chrome or Safari.",
      ),
    ],
  },
  announcements: {
    id: "admin-announcements",
    version: 1,
    steps: [
      step("announcements-new", "New announcement", "Write news for Home: an event this weekend, a rule change, a call for help. You write in English; players read it in their own language."),
      step("announcements-list", "All announcements", "Every announcement, drafts and expired ones included. Home shows the pinned ones first, then the newest."),
      step(
        "announcements-state",
        "On Home, Draft or Expired",
        "On Home: players see it. Draft: saved but hidden, for preparing a text before it goes out. Expired: its end time has passed, so Home no longer shows it. Translating: the other languages are still being written, which takes about a minute.",
      ),
      step(
        "announcements-actions",
        "Edit and Delete",
        "Edit opens the text, its settings and its translations. Delete removes it in every language at once and can't be undone; to take it off Home for now, untick Show on Home instead.",
      ),
    ],
  },
  announcement: {
    id: "admin-announcement",
    version: 1,
    steps: [
      step(
        "announcement-language",
        "Language",
        "English is the source: change the text here and every language is translated again. Pick another language to correct its translation by hand; that correction stays until the English changes.",
      ),
      step("announcement-title", "Title", "One short line, shown in bold above the text on Home."),
      step(
        "announcement-body",
        "Text",
        "Write here, or paste from Discord: the formatting comes along. The buttons add bold, headings, lists, links and tables. Preview shows the text exactly as players will see it, so check it before saving.",
      ),
      step(
        "editor-image",
        "Images",
        "Up to three per announcement. Tap the picture button, or paste or drop a screenshot into the text. Each image is shrunk to a small copy first, then a line with “Describe the image” appears: replace those words with what the image shows. To remove an image, delete its line.",
      ),
      step("announcement-expiry", "Leaves Home at", "Optional, in UTC: for news with an end date. After that time Home stops showing it, and it stays here as Expired."),
      step("announcement-published", "Show on Home", "Untick to keep a draft that players don't see. A draft that goes live later counts as new from that day."),
      step("announcement-pinned", "Pin to the top", "Pinned announcements stay above the others. Pin one or two at most, such as the welcome text or the coming battle."),
      step("announcement-save", "Save", "Players see the change within seconds, and the other languages follow within a minute. Every save is recorded with your name."),
      step("announcement-view", "View Home", "Opens Home in a new tab, to check how the announcement looks there."),
    ],
  },
  rules: {
    id: "admin-rules",
    version: 1,
    steps: [
      step("rules-new-topic", "New topic", "Topics are the tabs of the rules page, such as General conduct or Attacks & tiles. Make a new one when a group of rules doesn't fit the others."),
      step(
        "rules-topic",
        "A topic and its rules",
        "Each box is one tab of the rules page, with its rules in the order players read them. Hidden means the whole tab is off the page; Draft means one rule is.",
      ),
      step("rules-topic-actions", "Edit or delete a topic", "Edit changes the tab's name, icon and address. Delete removes the topic with all its rules in every language, and can't be undone."),
      step(
        "rules-rule",
        "Rules in order",
        "The arrows move a rule up or down within its topic; the arrows next to a topic move the whole tab. Edit opens the rule's text and translations.",
      ),
      step("rules-add", "Add a rule", "Adds a rule at the end of this topic. Write it in English: the other languages follow within a minute."),
    ],
  },
  ruleTopic: {
    id: "admin-rule-topic",
    version: 1,
    steps: [
      step("rule-topic-language", "Language", "English is the source: change the name here and it is translated again. Pick another language to correct its translation by hand."),
      step("rule-topic-title", "Name", "The tab's name on the rules page. Keep it to a few words."),
      step("rule-topic-icon", "Icon", "One emoji, shown before the name on the tab."),
      step(
        "rule-topic-slug",
        "Address",
        "Links to a tab end in # and this address, for example /rules#attacks. Leave it empty on a new topic to make one from the name. Change it only if you must: links people already shared stop opening this tab.",
      ),
      step("rule-topic-published", "Show on the rules page", "Untick to hide the tab and every rule in it, for example while you rewrite them."),
      step("rule-topic-save", "Save", "Players see the change within seconds. Every save is recorded with your name."),
      step("rule-topic-view", "View the tab", "Opens the rules page on this tab in a new browser tab."),
    ],
  },
  rule: {
    id: "admin-rule",
    version: 1,
    steps: [
      step("rule-language", "Language", "English is the source: change the text here and every language is translated again. Pick another language to correct its translation by hand; that correction stays until the English changes."),
      step("rule-topic", "Topic", "The tab the rule is listed under. Moving a rule to another topic puts it at the end of that topic."),
      step("rule-title", "Rule", "The rule itself in one line, shown in bold with its number."),
      step(
        "rule-body",
        "Explanation",
        "What the rule means in practice: what is allowed, what isn't, and what happens if someone breaks it. Preview shows it exactly as players will see it.",
      ),
      step(
        "editor-image",
        "Images",
        "Up to three per rule, such as a screenshot of the map. Tap the picture button, or paste or drop an image into the text; then replace “Describe the image” with what it shows.",
      ),
      step("rule-published", "Show on the rules page", "Untick to keep a draft that players don't see."),
      step("rule-save", "Save", "Players see the change within seconds, and the other languages follow within a minute. Every save is recorded with your name."),
      step("rule-view", "View the rules page", "Opens the rules page on this rule's tab in a new browser tab."),
    ],
  },
  guides: {
    id: "admin-guides",
    version: 1,
    steps: [
      step("guides-new", "New guide", "A guide explains how 1241 plays one event. Write the facts in your own words; when you use a fan site, add a Sources line with its link at the end."),
      step("guides-list", "All guides", "In the order of the guides page. Drafts stay here until you show them."),
      step("guides-order", "Order", "The arrows move a guide up or down the guides page. Put the events players ask about most at the top."),
      step("guides-state", "Shown or Draft", "Shown: players see it. Draft: only here. The tags at the end are the alliances that have their own section in that guide."),
      step("guides-actions", "Edit and Delete", "Edit opens the guide, its translations and its alliance sections. Delete removes the guide with its sections in every language and can't be undone."),
    ],
  },
  guide: {
    id: "admin-guide",
    version: 1,
    steps: [
      step("guide-language", "Language", "English is the source: change a text here and every language is translated again. Pick another language to correct its translation by hand."),
      step("guide-title", "Title", "Usually the event's name. It heads the guide and its card in the list."),
      step("guide-icon", "Icon", "One emoji for the guide's card and page."),
      step("guide-summary", "Summary", "One or two sentences on the guide's card, so players know what they will find."),
      step(
        "guide-slug",
        "Address",
        "The end of the guide's link, such as /guides/bear-hunt. Leave it empty on a new guide to make one from the title. Changing it breaks links people already shared; events that point to this guide follow by themselves.",
      ),
      step(
        "guide-body",
        "Text for everyone",
        "How the event works and what every player should do, whatever their alliance. Headings, lists and tables keep a long guide easy to read; Preview shows it as players will see it.",
      ),
      step("editor-image", "Images", "Up to ten per text. Tap the picture button, or paste or drop an image into the text; then replace “Describe the image” with what it shows."),
      step("guide-published", "Show on the guides page", "Untick to keep a draft that players don't see."),
      step("guide-save", "Save", "Players see the change within seconds, and the other languages follow within a minute. Every save is recorded with your name."),
      step(
        "guide-sections",
        "Alliance sections",
        "When an alliance plays this event its own way, it gets a section here. Players see the sections as tabs under the text for everyone, and their device remembers the alliance they picked.",
      ),
      step("guide-sections-add", "Add an alliance section", "Pick the alliance, then write how it plays the event. Any moderator can write or change any alliance's section; ask that alliance's R4 or R5 for the text."),
      step("guide-view", "View the guide", "Opens the guide in a new browser tab, to check how it looks to players."),
    ],
  },
  guideSection: {
    id: "admin-guide-section",
    version: 1,
    steps: [
      step("guide-section-language", "Language", "English is the source: change the text here and every language is translated again. Pick another language to correct its translation by hand."),
      step("guide-section-alliance", "Alliance", "The alliance this section is for, from the list on Home. Each alliance has at most one section per guide, and it can't be changed later: delete the section and add another instead."),
      step(
        "guide-section-body",
        "How this alliance plays it",
        "Only what differs for this alliance: its times, who sends what, its own rules. The text for everyone stays above it, so there is no need to repeat it.",
      ),
      step("editor-image", "Images", "Up to ten per section. Tap the picture button, or paste or drop an image into the text; then replace “Describe the image” with what it shows."),
      step("guide-section-published", "Show on the guide", "Untick to keep a draft that players don't see."),
      step("guide-section-save", "Save", "Players see the change within seconds, and the other languages follow within a minute. Every save is recorded with your name."),
      step("guide-section-view", "View the guide", "Opens the guide in a new browser tab, to check the alliance's tab."),
    ],
  },
  events: {
    id: "admin-events",
    version: 1,
    steps: [
      step(
        "events-new",
        "New event",
        "Adds an event to the calendar. Decide first whether it starts at the same time for everyone, or whether each alliance picks its own times.",
      ),
      step("events-list", "All events", "Every event, by its first round. Hidden ones stay here; players see the others on Home and the events page."),
      step("events-schedule", "The schedule", "How the event repeats, in UTC, in one line. Check it after every change: it is what the site counts from."),
      step("events-actions", "Edit and Delete", "Edit opens the event and its translations. Delete removes it in every language and can't be undone; to pause an event, hide it instead."),
    ],
  },
  event: {
    id: "admin-event",
    version: 1,
    steps: [
      step("event-language", "Language", "English is the source: change the name or summary here and every language is translated again. Pick another language to correct its translation by hand."),
      step("event-name", "Name", "The event's name as players know it from the game."),
      step("event-summary", "Summary", "One or two sentences on the card: what players do and what it gives."),
      step(
        "event-guide",
        "Guide",
        "The guide that explains the event; the card links to it. For an event each alliance times itself, that guide's alliance sections are where each alliance writes its times.",
      ),
      step(
        "event-timing",
        "Who sets the time",
        "Same time for everyone, like Alliance Championship: players see the start in their own time zone with a countdown. Each alliance picks, like Bear Hunt: players see only the day, and each alliance writes its times in the guide.",
      ),
      step("event-start", "A round to count from", "The day (and for a same-time event the UTC start) of any round, past or coming. The site counts every later round from it."),
      step(
        "event-repeat",
        "Length and repeats",
        "How long one round lasts and how many days until the next. A second day is for events that run twice a round: Viking Vengeance starts on a Tuesday, repeats every 14 days, and its second day is 2 days later.",
      ),
      step("event-published", "Show", "Untick to hide the event from Home and the events page without deleting it."),
      step("event-save", "Save", "Players see the change within seconds, and the other languages follow within a minute. Every save is recorded with your name."),
      step("event-view", "View the events page", "Opens the events page in a new browser tab, to check the card."),
    ],
  },
  alliances: {
    id: "admin-alliances",
    version: 1,
    steps: [
      step("alliances-list", "Alliances", "Every alliance on Home, strongest first. Each has a page players open from Home."),
      step("alliances-filled", "What is written", "Which parts of the alliance's page are filled in. Ask each alliance's R4 or R5 for its texts and its Discord invite."),
      step("alliances-actions", "Edit and View", "Edit writes the alliance's page; View opens it as players see it."),
    ],
  },
  alliance: {
    id: "admin-alliance",
    version: 1,
    steps: [
      step("alliance-language", "Language", "English is the source: change a text here and every language is translated again. Pick another language to correct its translation by hand."),
      step("alliance-description", "About the alliance", "A few lines in the leaders' own words: what kind of alliance it is, what it plays for, when it is active."),
      step("alliance-requirements", "Requirements", "What it asks of new members. Keep it short and concrete, such as a power or town-centre level."),
      step(
        "alliance-discord-link",
        "Discord invite",
        "An invite that never expires. Discord's usual invites stop working after seven days, so in Discord choose Edit invite link and set it to Never.",
      ),
      step("alliance-save", "Save", "Players see the change within seconds, and the other languages follow within a minute. Every save is recorded with your name."),
      step("alliance-view", "View the page", "Opens the alliance's page in a new browser tab."),
    ],
  },
  transfers: {
    id: "admin-transfers",
    version: 1,
    steps: [
      step(
        "kingdom-discord",
        "Kingdom Discord",
        "The invite to the server for all of 1241. With it, Home shows a Join our Discord button and every page links it at the bottom. Use an invite that never expires; empty hides both.",
      ),
      step(
        "transfers-switch",
        "Open or closed",
        "What players see next to the alliances on Home and on the transfers page; while open, Home's banner also shows a Transfers open badge. Nothing changes for them until you save.",
      ),
      step(
        "transfers-terms",
        "The game's terms",
        "Copy them from the game's Transfer Manager: the transfer group's kingdoms, when the window opens and closes (UTC), and the most Transfer Power a governor may have to move here without a special invite (in millions, such as 97.5). Players see them while open; leave out what you don't know yet.",
      ),
      step("transfers-info", "Anything else", "Optional, shown while open, with bold, lists and links: such as how many slots there are or what you expect of newcomers."),
      step("transfers-contact", "Whom to ask", "Optional, always on the transfers page: who answers players who want to move here, such as a name with their Discord handle."),
      step(
        "transfers-discord",
        "Discord for transfers",
        "A Join the transfer Discord button under whom to ask, open or closed: your transfer server or channel, which may differ from the kingdom's. Empty: the kingdom Discord, as Join our Discord.",
      ),
      step("transfers-language", "Language", "English is the source. Pick another language to correct a translation by hand."),
      step("transfers-save", "Save", "Every change is recorded with your name."),
      step("transfers-view", "View the page", "Opens the transfers page in a new browser tab."),
      step(null, "Good practice", "Fill in the terms before you open transfers, and close them again as soon as the window ends or the slots are taken."),
    ],
  },
  giftCodes: {
    id: "admin-gift-codes",
    version: 1,
    steps: [
      step(
        "gift-codes-check",
        "Checked every hour",
        "The site reads kingshot.net's list of working codes every hour: a new code goes on Home, and one it stops listing leaves Home. This line says when it last looked. Check now looks at once, for example right after a code was announced.",
      ),
      step(
        "gift-codes-list",
        "Codes",
        "What players see on Home, newest first. From kingshot.net: found there. Added by hand: added here by a moderator.",
      ),
      step(
        "gift-codes-actions",
        "The buttons",
        "Edit: write what the code gives, or its expiry. Hide from Home: for a code that doesn't work for our kingdom; the hourly check leaves it hidden. Delete: only for codes added by hand or ended ones, because kingshot.net would bring the others back within the hour.",
      ),
      step("gift-codes-add", "Add a code", "For a code from in-game mail, an event or Discord that isn't on the list yet. Once kingshot.net lists it too, the hourly check takes it over and ends it when it stops working."),
      step("gift-codes-code", "Code", "Exactly as the game writes it, upper and lower case included: codes are case-sensitive. Copy it rather than typing it."),
      step("gift-codes-rewards", "What it gives", "Optional, one short line in English, such as “200 gems and 3 speedups”. Players read it in their language; the translation follows within a minute."),
      step("gift-codes-expiry", "Expires", "Optional, in UTC. Leave it empty when the announcement gives no end; the code then stays until it stops working or you hide it."),
      step("gift-codes-old", "Ended and expired", "Codes that stopped working. They are kept for 30 days, then deleted by themselves."),
    ],
  },
  rallySync: {
    id: "admin-rally-sync",
    version: 1,
    steps: [
      step(
        "rs-new",
        "New room",
        "One room per group on battle day: a rally room per attack wave, a counter-rally room for the counter alliance, a garrison room for the defenders. How many of each can be open at once is shown under Rooms.",
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
        "Open now counts the rooms of each kind against the owner's limit. Below, every room with its mode and activity: Open goes in; New coordinator link replaces a lost one (the old one stops working); Destroy closes it at once.",
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
  settings: {
    id: "admin-settings",
    version: 5,
    steps: [
      step(
        "settings-tabs",
        "Five tabs",
        "General holds the owner, the translation brake, the wrong-password rules and the feedback defaults; Usage says whether anything needs you; Rally Sync, Alliances and Languages have a tab each. Each tab opens only its own part, and has its own link.",
      ),
      step(
        "settings-usage-verdict",
        "At a glance",
        "One line for everything below: all fine, something to watch (amber) or something that needs action (red), with their names. The same line sits at the top of the admin Overview, so a daily look is one click.",
      ),
      step(
        "settings-usage-database",
        "Database",
        "Its size against the free plan's 500 MB, the disk (read-only at 95 %), stored files, open connections and how much is read from memory. Each line says what it means, and links to Supabase's own report.",
      ),
      step(
        "settings-usage-jobs",
        "Live use and jobs",
        "Rally Sync browsers against the 180 budget, and when each background job last ran: the weekly backup, the daily cleanup, the alliance sync and the hourly gift-code check. A job that stops turns amber, then red.",
      ),
      step(
        "settings-usage-elsewhere",
        "Measured elsewhere",
        "What only Vercel, Supabase and Anthropic know (CPU, data transfer, egress, the AI bill), with a link to each. Worth a look once a week, and whenever they e-mail you.",
      ),
      step(
        "settings-owner",
        "The owner",
        "You. The owner is set once, when the site is set up (SITE_OWNER in Vercel), and nothing in the site can change it. Only you see this page and its link.",
      ),
      step(
        "settings-capacity",
        "Rally Sync capacity",
        "How many rooms of each kind moderators can open at once, and how many leaders and browsers each room takes. Changes apply at once for everyone.",
      ),
      step(
        "settings-modes",
        "One card per kind of room",
        "Rally rooms are our attacks, garrison rooms our defence (a few coordinators, many defenders watching), counter-rally rooms the counter alliance's launch order. Tap minus or plus, or type a number.",
      ),
      step(
        "settings-total",
        "The shared limit",
        "Every browser in a room keeps one live connection, and Supabase's free plan allows 200. So all rooms together, if full, may hold 180 browsers. Over that the box turns red, outlines the numbers and offers one to lower.",
      ),
      step("settings-save", "Save", "Save waits until the total fits. Undo changes goes back to what is saved; Use the recommended numbers puts back the battle-day defaults."),
      step(
        "settings-alliances",
        "Alliances",
        "The alliances on Home. Each one is linked to its alliance in MightPulse, so tag, name, power, leader and members update by themselves every morning, even after a rename.",
      ),
      step(
        "settings-alliances-sync",
        "Sync now",
        "The line says when the last sync ran and whether it worked. Sync now runs it at once, e.g. after a merger; it takes up to a minute.",
      ),
      step(
        "settings-alliances-list",
        "The list",
        "Only these alliances are on Home, whatever their rank; adding and removing is your call. Edit corrects the numbers by hand while MightPulse is down (marked as typed by hand until the next sync) and sets the colour. Hide from Home keeps it on the list; Remove takes it off.",
      ),
      step(
        "settings-alliances-ranking",
        "The ranking",
        "The kingdom's ten strongest alliances as MightPulse last saw them. One that isn't on the list but reaches the top six is held for review: it shows here, never on Home. Add puts one on the list and on Home.",
      ),
      step(
        "settings-alliances-battle",
        "Battle alliances",
        "Every player joins KvK or TMP for the castle battle and KvK, so on battle day those two top the ranking and the others empty out. They are never on Home and never ranked with the others. On a battle day, every second Saturday until noon the day after, the alliances keep their numbers from before the battle.",
      ),
      step("settings-alliances-hand", "By hand", "For an alliance MightPulse doesn't know yet: add it with its tag, and the next sync links it."),
      step(
        "settings-languages",
        "Languages",
        "The order of the language menu, and which languages players can pick. Hide one and nothing is translated into it any more; Show brings it back. A new language comes as a code change, with its game words and a review.",
      ),
      step(
        "settings-languages-save",
        "Save the languages",
        "Arrange the list first: the arrows, Hide and Show change nothing for players until you press Save, which updates the menu on every page at once. Undo changes puts the list back as it is on the site.",
      ),
      step(
        "settings-translation",
        "Machine translation",
        "A brake on the AI bill. While paused, edited texts show in English in the other languages and the feedback AI buttons wait. After resuming, run the Maintenance translate task once to fill the gaps.",
      ),
      step(
        "settings-passwords",
        "Wrong passwords",
        "How quickly guessing a page or room password is slowed down for one address, and when the council is alerted. The line under the numbers says in plain words what they do.",
      ),
      step("settings-feedback", "Feedback forms", "What a new battle feedback form starts with: how long its answers are kept, and the most answers per battle."),
      step(
        null,
        "Good practice",
        "Set the numbers the day before a big battle, not in the middle of it. Lowering one never closes a room or removes anyone: it only stops new ones until some close. Every change appears under Recent changes.",
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
  if (section === "feedback") return parts.length === 1 ? "feedback" : parts.length === 2 && id ? "results" : parts.length === 3 && sub === "print" ? "print" : null;
  if (parts.length === 1 && section === "rally-sync") return "rallySync";
  if (section === "announcements") return parts.length === 1 ? "announcements" : parts.length === 2 ? "announcement" : null;
  if (section === "events") return parts.length === 1 ? "events" : parts.length === 2 ? "event" : null;
  if (section === "alliances") return parts.length === 1 ? "alliances" : parts.length === 2 ? "alliance" : null;
  if (parts.length === 1 && section === "transfers") return "transfers";
  if (section === "rules") return parts.length === 1 ? "rules" : parts.length === 2 && id !== "topics" ? "rule" : parts.length === 3 && id === "topics" ? "ruleTopic" : null;
  if (section === "guides") return parts.length === 1 ? "guides" : parts.length === 2 ? "guide" : parts.length === 4 && sub === "alliances" ? "guideSection" : null;
  if (parts.length === 1 && section === "gift-codes") return "giftCodes";
  if (parts.length === 1 && section === "users") return "users";
  // One guide for every tab of the settings: steps for parts not on the open tab are left out.
  if (section === "settings" && (parts.length === 1 || (parts.length === 2 && ["usage", "rally-sync", "alliances", "languages"].includes(id)))) return "settings";
  return null;
}
