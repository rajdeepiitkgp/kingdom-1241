/** Accent colours for event cards. Keys are stored on events (`color` column). */
export const EVENT_COLORS: Record<string, { icon: string; ring: string }> = {
  amber: { icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200", ring: "border-amber-200/70 dark:border-amber-400/30" },
  red: { icon: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200", ring: "border-rose-200/70 dark:border-rose-400/30" },
  violet: { icon: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200", ring: "border-violet-200/70 dark:border-violet-400/30" },
  sky: { icon: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200", ring: "border-sky-200/70 dark:border-sky-400/30" },
  gold: { icon: "bg-gold-soft text-gold-strong", ring: "border-gold/50" },
  emerald: { icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200", ring: "border-emerald-200/70 dark:border-emerald-400/30" },
  pink: { icon: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-200", ring: "border-pink-200/70 dark:border-pink-400/30" },
};

export function eventColor(key: string) {
  return EVENT_COLORS[key] ?? EVENT_COLORS.sky;
}
