"use client";

import clsx from "clsx";
import { Gem, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import {
  calculatePackValue,
  DEFAULT_GEMS_PER_UNIT,
  PACK_CATEGORIES,
  PACK_ITEM_CATALOG,
  type PackLine,
  type PackRating,
} from "@/lib/tools/pack-value";
import { NumberField, parseNumber } from "./NumberField";

interface LineState {
  key: number;
  itemId: string;
  name: string;
  quantity: string;
  gems: string;
  basicResource: boolean;
}

const RATING_STYLE: Record<PackRating, string> = {
  insane: "bg-success text-white",
  great: "bg-success-soft text-success",
  good: "bg-primary-soft text-primary",
  average: "bg-gold-soft text-gold-strong",
  poor: "bg-danger-soft text-danger",
};

let nextKey = 1;
const newKey = () => nextKey++;

function lineFromCatalog(itemId: string): LineState {
  if (itemId === "custom") {
    return { key: newKey(), itemId: "custom", name: "", quantity: "1", gems: "0", basicResource: false };
  }
  const item = PACK_ITEM_CATALOG.find((i) => i.id === itemId) ?? PACK_ITEM_CATALOG[0];
  return {
    key: newKey(),
    itemId: item.id,
    name: item.name,
    quantity: "1",
    gems: String(item.gems),
    basicResource: Boolean(item.basicResource),
  };
}

const DEFAULT_LINES = (): LineState[] => [
  { ...lineFromCatalog("gem"), quantity: "1000" },
  { ...lineFromCatalog("speedup-1h"), quantity: "10" },
  { ...lineFromCatalog("forgehammer"), quantity: "5" },
  { ...lineFromCatalog("bread-10k"), quantity: "100" },
];

export function PackValueCalculator({ dict, locale }: { dict: Dictionary; locale: string }) {
  const [price, setPrice] = useState("4.99");
  const [gemsPerUnit, setGemsPerUnit] = useState(String(DEFAULT_GEMS_PER_UNIT));
  const [excludeResources, setExcludeResources] = useState(false);
  const [lines, setLines] = useState<LineState[]>(DEFAULT_LINES);
  const [picker, setPicker] = useState("");
  const toggleId = useId();

  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);

  const result = useMemo(() => {
    const packLines: PackLine[] = lines.map((l) => ({
      itemId: l.itemId,
      name: l.name,
      quantity: parseNumber(l.quantity),
      gems: parseNumber(l.gems, true),
      basicResource: l.basicResource,
    }));
    return calculatePackValue(packLines, parseNumber(price, true), parseNumber(gemsPerUnit, true), excludeResources);
  }, [lines, price, gemsPerUnit, excludeResources]);

  function addItem(itemId: string) {
    if (!itemId) return;
    setLines((current) => [...current, lineFromCatalog(itemId)]);
    setPicker("");
  }

  function updateLine(key: number, patch: Partial<LineState>) {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const hasLines = lines.length > 0;
  const barWidth = Math.min(100, result.valuePercent / 50); // 5000% fills the bar

  return (
    <section className="card p-5 md:p-6" aria-labelledby="pack-title">
      <header className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold-soft text-gold-strong">
          <Gem className="size-6" aria-hidden />
        </span>
        <div>
          <h2 id="pack-title" className="text-xl font-extrabold text-ink">{dict["tools.pack.title"]}</h2>
          <p className="mt-1 text-sm text-ink-muted">{dict["tools.pack.description"]}</p>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Inputs */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label={dict["tools.pack.price"]} value={price} onChange={setPrice} decimals />
            <NumberField label={dict["tools.pack.gemsPerUnit"]} value={gemsPerUnit} onChange={setGemsPerUnit} decimals />
          </div>
          <p className="-mt-3 text-xs font-semibold text-ink-faint">{dict["tools.pack.gemsPerUnitHint"]}</p>

          <fieldset>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <legend className="label !mb-0">{dict["tools.pack.contents"]}</legend>
              <div className="flex items-center gap-2">
                <label className="relative">
                  <span className="sr-only">{dict["tools.pack.addItem"]}</span>
                  <select
                    value={picker}
                    onChange={(e) => addItem(e.target.value)}
                    className="h-9 cursor-pointer appearance-none rounded-xl border border-line bg-card ps-8 pe-7 text-sm font-extrabold text-ink shadow-[0_3px_0_0_var(--line)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
                  >
                    <option value="">{dict["tools.pack.addItem"]}</option>
                    {PACK_CATEGORIES.map((category) => (
                      <optgroup key={category} label={dict[`tools.pack.category.${category}`]}>
                        {PACK_ITEM_CATALOG.filter((i) => i.category === category).map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({nf.format(item.gems)})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <optgroup label={dict["tools.pack.category.other"]}>
                      <option value="custom">{dict["tools.pack.custom"]}</option>
                    </optgroup>
                  </select>
                  <Plus className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-primary" aria-hidden />
                </label>
                <button type="button" className="btn-ghost btn-sm !py-1.5" onClick={() => setLines([])} aria-label={dict["tools.pack.reset"]} title={dict["tools.pack.reset"]}>
                  <RotateCcw className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            {!hasLines ? (
              <p className="rounded-2xl bg-card-soft px-4 py-6 text-center text-sm font-semibold text-ink-muted">{dict["tools.pack.empty"]}</p>
            ) : (
              <ul className="space-y-2">
                {lines.map((line, index) => {
                  const lineResult = result.lines[index];
                  return (
                    <li key={line.key} className="grid grid-cols-[minmax(0,1fr)_5rem_6rem_auto] items-end gap-2 rounded-2xl bg-card-soft p-2.5 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_4rem_auto]">
                      <div className="min-w-0">
                        <label className="label mb-1 text-xs">{dict["tools.pack.item"]}</label>
                        {line.itemId === "custom" ? (
                          <input
                            type="text"
                            value={line.name}
                            placeholder={dict["tools.pack.custom"]}
                            onChange={(e) => updateLine(line.key, { name: e.target.value })}
                            className="input px-3 py-2 text-sm"
                          />
                        ) : (
                          <p className="truncate rounded-2xl border border-transparent px-1 py-2 text-sm font-bold text-ink" title={line.name}>
                            {line.name}
                          </p>
                        )}
                      </div>
                      <NumberField compact label={dict["tools.pack.quantity"]} value={line.quantity} onChange={(v) => updateLine(line.key, { quantity: v })} />
                      <NumberField compact decimals label={dict["tools.pack.gemValue"]} value={line.gems} onChange={(v) => updateLine(line.key, { gems: v })} />
                      <div className="hidden text-end sm:block">
                        <p className="label mb-1 text-xs">{dict["tools.pack.share"]}</p>
                        <p className="tabular py-2 text-sm font-extrabold text-ink">{lineResult ? `${pf.format(lineResult.share)}%` : "—"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                        className="btn-ghost btn-sm mb-0.5 !px-2.5"
                        aria-label={dict["tools.pack.remove"]}
                        title={dict["tools.pack.remove"]}
                      >
                        <Trash2 className="size-4 text-danger" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          <label htmlFor={toggleId} className="flex cursor-pointer items-center gap-3 text-sm font-bold text-ink">
            <input
              id={toggleId}
              type="checkbox"
              checked={excludeResources}
              onChange={(e) => setExcludeResources(e.target.checked)}
              className="size-5 accent-[var(--primary)]"
            />
            {dict["tools.pack.excludeResources"]}
          </label>
        </div>

        {/* Results */}
        <div className="space-y-3">
          <div className={clsx("rounded-[1.5rem] p-5 text-center", RATING_STYLE[result.rating])}>
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">{dict["tools.pack.valuePercent"]}</p>
            <p className="tabular mt-1 text-5xl font-black leading-none">{hasLines ? `${pf.format(result.valuePercent)}%` : "—"}</p>
            <p className="mt-2 text-sm font-extrabold">{hasLines ? dict[`tools.pack.rating.${result.rating}`] : dict["tools.pack.empty"]}</p>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-card-soft" dir="ltr" aria-hidden>
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-all" style={{ width: `${barWidth}%` }} />
          </div>

          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-card-soft px-4 py-3">
              <dt className="text-xs font-bold text-ink-muted">{dict["tools.pack.totalGems"]}</dt>
              <dd className="tabular text-xl font-black text-ink">💎 {nf.format(Math.round(result.totalGems))}</dd>
            </div>
            <div className="rounded-2xl bg-card-soft px-4 py-3">
              <dt className="text-xs font-bold text-ink-muted">{dict["tools.pack.baselineGems"]}</dt>
              <dd className="tabular text-xl font-black text-ink">💎 {nf.format(Math.round(result.baselineGems))}</dd>
            </div>
          </dl>

          <p className="text-xs font-semibold text-ink-faint">{dict["tools.pack.valuesNote"]}</p>
        </div>
      </div>
    </section>
  );
}
