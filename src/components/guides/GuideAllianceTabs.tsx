// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { useRef, useState, useSyncExternalStore } from "react";
import { SanitizedHtml } from "@/components/content/SanitizedHtml";
import { openSection } from "@/lib/content/guide-sections";
import { readNoAlliance, readRememberedAlliance, rememberAlliance, subscribeAlliance } from "./alliance-memory";

/** One alliance's section in the visitor's language, sanitised on the server (see guides/[slug]/page.tsx). */
export interface GuideAllianceTab {
  tag: string;
  label: string;
  html: string;
}

/**
 * The guide's alliance sections as tabs, one per alliance that plays the event
 * its own way. Opens the alliance this device picked last (in any guide), else
 * the first; the server renders the first, so the page works without script.
 */
export function GuideAllianceTabs({ tabs, labels }: { tabs: GuideAllianceTab[]; labels: { title: string; hint: string; tabs: string } }) {
  const remembered = useSyncExternalStore(subscribeAlliance, readRememberedAlliance, readNoAlliance);
  const [clicked, setClicked] = useState<string | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeTag = openSection(
    tabs.map((tab) => tab.tag),
    clicked ?? remembered,
  );
  const active = tabs.find((tab) => tab.tag === activeTag);
  if (!active) return null;
  const index = tabs.indexOf(active);

  function select(tag: string) {
    setClicked(tag);
    rememberAlliance(tag);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const forward = (event.key === "ArrowRight") !== (document.documentElement.dir === "rtl");
    const next = tabs[(index + (forward ? 1 : -1) + tabs.length) % tabs.length];
    select(next.tag);
    tabRefs.current[next.tag]?.focus();
  }

  const panelId = "guide-alliance-panel";
  return (
    <section className="card mt-5 p-6 md:p-8" aria-labelledby="guide-alliances" data-tour="guide-alliances">
      <h2 id="guide-alliances" className="text-xl font-black text-ink">
        {labels.title}
      </h2>
      <p className="mt-1 text-sm font-semibold text-ink-muted">{labels.hint}</p>

      {tabs.length > 1 ? (
        <div role="tablist" aria-label={labels.tabs} onKeyDown={onKeyDown} className="-mx-6 mt-4 no-scrollbar flex gap-2 overflow-x-auto px-6 pb-2 md:mx-0 md:flex-wrap md:px-0">
          {tabs.map((tab) => {
            const selected = tab.tag === active.tag;
            return (
              <button
                key={tab.tag}
                ref={(el) => {
                  tabRefs.current[tab.tag] = el;
                }}
                role="tab"
                type="button"
                id={`guide-alliance-${tabs.indexOf(tab)}`}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(tab.tag)}
                className={clsx(
                  "shrink-0 rounded-2xl border px-4 py-2 text-sm font-extrabold transition-all",
                  selected
                    ? "border-primary bg-primary text-primary-ink shadow-[0_4px_0_0_var(--primary-strong)]"
                    : "border-line bg-card text-ink-muted shadow-[0_4px_0_0_var(--line)] hover:bg-card-soft hover:text-ink",
                )}
              >
                <span dir="auto">{tab.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 inline-flex rounded-2xl bg-primary-soft px-4 py-2 text-sm font-extrabold text-ink" dir="auto">
          {active.label}
        </p>
      )}

      <div
        id={panelId}
        role={tabs.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={tabs.length > 1 ? `guide-alliance-${index}` : undefined}
        className="mt-4"
      >
        <SanitizedHtml html={active.html} />
      </div>
    </section>
  );
}
