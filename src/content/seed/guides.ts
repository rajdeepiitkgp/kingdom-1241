/**
 * Event guides. The mechanics below reflect how the events generally work;
 * the "How 1241 plays it" sections are placeholders for the kingdom's own
 * strategy and are meant to be edited by admins.
 */
export interface SeedGuide {
  id: string;
  slug: string;
  title: string;
  summary: string;
  icon: string;
  sortOrder: number;
  bodyMarkdown: string;
}

export const SEED_GUIDES: SeedGuide[] = [
  {
    id: "f1000000-0000-4000-8000-000000000001",
    slug: "bear-hunt",
    title: "Bear Hunt",
    summary: "30 minutes of rallies against a bear that never fights back. Archers, lethality and good joiner heroes win.",
    icon: "🐻",
    sortOrder: 0,
    bodyMarkdown: `## What it is

Bear Hunt is an **alliance rally event**. For 30 minutes everyone rallies the alliance's bear trap. The bear doesn't fight back, so nobody loses troops — only your **Attack** and **Lethality** matter. Damage is pooled per alliance and converted into rewards (Forgehammers, Lucky Hero Gear Chests and more).

Each alliance can run a hunt roughly every two days; an R4/R5 starts it or schedules it with Auto-Register.

## Who does what

- **Rally hosts** (the strongest players) open rallies in the first minutes. The host's three hero skills and research apply to the whole rally.
- **Joiners** fill rallies. Only your **first hero's first expedition skill** counts, and only four joiner skills are active per rally — send your best lethality hero in slot one.
- From minute ~23 everyone opens a rally so troops keep cycling until the end.

## Troop ratio

The bear doesn't attack, so send almost only archers:

| Hero generation | Infantry / Cavalry / Archers |
| --- | --- |
| Gen 1 | 10 / 30 / 60 |
| Gen 2 | 10 / 20 / 70 |
| Gen 3 | 10 / 10 / 80 |
| Gen 4+ | 1 / 10 / 89 (keep ≥ 5,000 infantry) |

Use the **Rally troop refill** tool on this site to work out what to send when a rally is unbalanced.

## How 1241 plays it

> Alliance leaders: write your alliance's hunt times, rally host list and joiner rules here.

- Hunt times: _edit me_
- Rally hosts: _edit me_
- Joiner hero: your best lethality hero in slot 1, no defensive or economy heroes.

## Tips

- Activate your pet buffs **before** the first rally.
- Check the troop ratio on the march screen, not from memory.
- Keep the alliance **Pitfall** level up — level 5 gives +25% attack.`,
  },
  {
    id: "f1000000-0000-4000-8000-000000000002",
    slug: "viking-vengeance",
    title: "Viking Vengeance",
    summary: "20 waves of Vikings attack the alliance. Reinforce friends and the HQ with infantry-heavy marches.",
    icon: "🪓",
    sortOrder: 1,
    bodyMarkdown: `## What it is

Viking Vengeance is an **alliance defence event**. Waves of Vikings attack the towns of alliance members and the alliance HQ. Your troops earn points for every Viking they defeat — in your own town or in a town you reinforced.

A session has **20 waves**:

- **Regular waves** hit members' towns.
- **Online-only waves (7, 14, 17)** hit only governors who are online — the highest-scoring waves.
- **HQ waves (10 and 20)** attack the alliance HQ, which accepts up to 15 reinforcement marches. Wave 20 is the hardest.

## Troops & heroes

- Standard defence ratio: **75% infantry / 25% cavalry / 0% archers**. For HQ wave 10 use 90/10/0.
- Keep your three strongest heroes in the Guard Station.
- As a reinforcement lead hero use a strong attack hero (the same ones you use for Bear Hunt). Flat percentage buffs stack across reinforcers; proc-based skills don't.
- Activate deployment-capacity buffs before you send marches.

## How 1241 plays it

> Alliance leaders: edit this section with your buddy groups and HQ plan.

1. One to two hours before the start, exchange reinforcements inside your **buddy group** (3–6 players). About four reinforcers per town.
2. HQ: everyone sends \`rally capacity ÷ 15\` troops before wave 10 and again before wave 20.
3. Stay online for waves 7, 14 and 17.

## Rewards

Points are converted into personal and alliance milestone rewards. Milestones are cumulative, so reaching a higher tier also gives all lower ones.`,
  },
  {
    id: "f1000000-0000-4000-8000-000000000003",
    slug: "swordland-showdown",
    title: "Swordland Showdown",
    summary: "A one-hour cross-kingdom alliance battle over Sanctums, Abbeys and the Swordshrine.",
    icon: "⚔️",
    sortOrder: 2,
    bodyMarkdown: `## What it is

Swordland Showdown is a **cross-kingdom alliance vs alliance battle** on a special map. The alliance with more **Relic Points** after one hour wins. Alliances qualify via the Alliance Power leaderboard, then go through voting, registration (R4/R5 pick the battle time) and matchmaking.

Each legion can register **30 combatants and 10 substitutes**. Matchmaking looks at the squad power of your top 20 registered governors — registering fewer people does not give an easier opponent.

## The map

| Structure | Why it matters |
| --- | --- |
| Swordshrine | Highest point income; locked at the start |
| Sanctum | High, steady Relic Point income |
| Abbey | Steady Relic Point income |
| Bell Tower | Shorter occupation time |
| Royal Stables | Shorter free-teleport cooldown |
| Hall of Reformation | Combat bonus |
| Mercenary Camp | Lets you send mercenaries at buildings |
| Undercellars | Gatherable Relic Points |

Points come from first control of buildings, holding them, collecting dropped packages and gathering Undercellars. Captured buildings scatter their stored points as packages — grab them fast.

## How 1241 plays it

> Alliance leaders: put your building assignments and teleport plan here.

- Spread out early for first-control points, then consolidate on Sanctums.
- Only contest the Swordshrine if you can hold it.
- If you leave to heal, remember the **12-minute** re-entry cooldown.

## Rewards

Rewards depend on the result of **Legion 1**. The Swordland Shop sells Artisan's Vision, Charm Guides and Charm Designs — buy whatever is your current bottleneck.`,
  },
  {
    id: "f1000000-0000-4000-8000-000000000004",
    slug: "kvk",
    title: "KvK — Kingdom vs Kingdom",
    summary: "Five preparation days, then the castle battle. The whole kingdom fights together.",
    icon: "🏰",
    sortOrder: 3,
    bodyMarkdown: `## Overview

KvK (Kingdom of Power) pits Kingdom 1241 against another kingdom of similar strength. It has three phases:

1. **Matchmaking (2 days)** — the opponent is revealed on day 2.
2. **Preparation (5 days)** — daily themed scoring. The kingdom with more prep points wins the **attacking position**, State Bonus buffs and an untouchable castle.
3. **Battle day** — cross-kingdom movement from 10:00 to 22:00 UTC; the **castle battle starts at 12:00 UTC**.

## Preparation phase

- Reach **200,000 personal points every day** for the daily chest and a State Medal.
- Mithril is worth 40,000 points each on days 4 and 5 — save it.
- Duel of the Elites: the top 150 active governors are split into 10 groups; the winner of each group gives the kingdom a prep bonus for the next stage.
- Activate buffs (Wolf pet, Double Time, Chief Minister) **before** spending.

## Battle day

- The first kingdom to hold the castle for **2.5 continuous hours** wins; otherwise the longest total occupation wins.
- You can only fight governors whose Town Center is within **3 levels** of yours — other fights give zero points.
- Four **turrets** give lethality bonuses to squads in the castle. Take the turrets before pushing the castle.
- Join rallies and garrisons; never attack alone.
- Show up to earn the **6th State Medal** that unlocks the final reward tier.

## After the battle

Field Triage lets you recover lost troops: each player gets 20 Rescue Orders to give away and can receive up to 50 (30% base recovery, up to 90%). Send yours to the strongest fighters first.

## How 1241 plays it

> Kingdom council: the detailed battle plan (rally leaders, attack and defence groups, UTC hours) will live in the password-protected KvK section in a later phase. Use this space for the public strategy summary.`,
  },
  {
    id: "f1000000-0000-4000-8000-000000000005",
    slug: "alliance-championship",
    title: "Alliance Championship",
    summary: "Register one march into one of three lanes. Five automated rounds against five other alliances.",
    icon: "🏆",
    sortOrder: 4,
    bodyMarkdown: `## What it is

A weekly alliance event with sign-up, matchmaking, preparation, battle and completion phases. Your alliance faces **five other alliances** in five automated rounds. Each round has three **lane battles**; win two of three lanes to win the round. Nobody needs to be online during the battles.

## Registration

- Town Center 10 or higher; at least 10 registered members for the alliance to enter matchmaking.
- Each player registers **one march** into **one of three lanes**. Registration saves a snapshot of your march and active buffs — re-registering overwrites it, so register when your buffs are on.
- Up to 20 fighters per lane (60 total). Within a lane, stronger marches fight later.
- A common starting troop mix is **50% infantry / 20% cavalry / 30% archers**.

## How 1241 plays it

> R4/R5: put your lane plan here.

The usual plan is **two strong lanes and one sacrifice lane**: the strongest ~40 players go into the two priority lanes, everyone else into the sacrifice lane. From round 2 on, look at the enemy's previous lane distribution and match your sacrifice lane against their strongest lane.

## Battles

Each march can knock out at most **2 enemy marches** per round, then stops. Avoid over-stacking one lane and don't try to win all three lanes equally.

## Rewards

KO rewards (research speedups, resources) plus a final tier from Stone to Diamond. The Championship Shop rotates hero progression items, Gilded Threads, Satin, speedups and skill materials.`,
  },
];
