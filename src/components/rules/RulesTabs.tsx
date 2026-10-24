"use client";

import clsx from "clsx";
import { useRef, useState, useSyncExternalStore } from "react";
import { RichText } from "@/components/content/RichText";
import type { RuleTopic } from "@/lib/data/types";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => decodeURIComponent(window.location.hash.replace(/^#/, ""));
const readServerHash = () => "";

export function RulesTabs({ topics, dict, locale }: { topics: RuleTopic[]; dict: Dictionary; locale: string }) {
  // Deep links: /rules#kvk opens the KvK tab. A click overrides the hash.
  const hashSlug = useSyncExternalStore(subscribeHash, readHash, readServerHash);
  const [clickedSlug, setClickedSlug] = useState<string | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const wantedSlug = clickedSlug ?? hashSlug;
  const active = topics.find((t) => t.slug === wantedSlug) ?? topics[0];
  if (!active) {
    return <p className="card px-5 py-6 text-center font-semibold text-ink-muted">{dict["rules.noRules"]}</p>;
  }

  function select(slug: string) {
    setClickedSlug(slug);
    window.history.replaceState(null, "", `#${slug}`);
    tabRefs.current[slug]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = topics.findIndex((t) => t.slug === active!.slug);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const rtl = document.documentElement.dir === "rtl";
      const forward = (event.key === "ArrowRight") !== rtl;
      const nextIndex = (index + (forward ? 1 : -1) + topics.length) % topics.length;
      select(topics[nextIndex].slug);
      tabRefs.current[topics[nextIndex].slug]?.focus();
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={dict["rules.title"]}
        onKeyDown={onKeyDown}
        className="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 md:mx-0 md:flex-wrap md:px-0"
      >
        {topics.map((topic) => {
          const selected = topic.slug === active.slug;
          return (
            <button
              key={topic.id}
              ref={(el) => {
                tabRefs.current[topic.slug] = el;
              }}
              role="tab"
              id={`tab-${topic.slug}`}
              aria-selected={selected}
              aria-controls={`panel-${topic.slug}`}
              tabIndex={selected ? 0 : -1}
              type="button"
              onClick={() => select(topic.slug)}
              className={clsx(
                "inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-extrabold transition-all",
                selected
                  ? "border-primary bg-primary text-primary-ink shadow-[0_4px_0_0_var(--primary-strong)]"
                  : "border-line bg-card text-ink-muted shadow-[0_4px_0_0_var(--line)] hover:bg-card-soft hover:text-ink",
              )}
            >
              <span aria-hidden>{topic.icon}</span>
              {pick(topic.title, locale)}
            </button>
          );
        })}
      </div>

      <section
        role="tabpanel"
        id={`panel-${active.slug}`}
        aria-labelledby={`tab-${active.slug}`}
        className="mt-3"
      >
        <h2 className="sr-only">{pick(active.title, locale)}</h2>
        {active.rules.length === 0 ? (
          <p className="card px-5 py-6 text-center font-semibold text-ink-muted">{dict["rules.noRules"]}</p>
        ) : (
          <ol className="grid grid-cols-1 gap-3">
            {active.rules.map((rule, index) => (
              <li key={rule.id} className="card flex gap-4 p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold text-sm font-black text-on-gold shadow-[0_3px_0_0_var(--gold-strong)]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-extrabold text-ink" dir="auto">{pick(rule.title, locale)}</h3>
                  <RichText html={pick(rule.body, locale)} className="mt-1.5 text-[0.98rem]" />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
