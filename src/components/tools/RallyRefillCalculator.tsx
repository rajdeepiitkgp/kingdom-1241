// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { AlertTriangle, Swords } from "lucide-react";
import { useMemo, useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { calculateRefill, REFILL_PRESETS, TROOP_TYPES, type TroopType } from "@/lib/tools/rally-refill";
import { NumberField, parseNumber } from "./NumberField";

const TROOP_ICONS: Record<TroopType, string> = { infantry: "🛡️", cavalry: "🐎", archers: "🏹" };

const PRESET_KEYS = ["bearGen4", "bearGen1", "balanced", "infantryWall", "vikings"] as const;

export function RallyRefillCalculator({ dict, locale }: { dict: Dictionary; locale: string }) {
  const [capacity, setCapacity] = useState("1500000");
  const [current, setCurrent] = useState<Record<TroopType, string>>({ infantry: "60000", cavalry: "120000", archers: "420000" });
  const [target, setTarget] = useState<Record<TroopType, string>>({ infantry: "1", cavalry: "10", archers: "89" });
  const [preset, setPreset] = useState<string | null>("bearGen4");

  // Formatted on the server too: the elements that show a number carry suppressHydrationWarning, because a
  // browser with older locale data (digits, separators) would otherwise make React redraw the page (#418).
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);

  const result = useMemo(
    () =>
      calculateRefill({
        capacity: parseNumber(capacity),
        current: {
          infantry: parseNumber(current.infantry),
          cavalry: parseNumber(current.cavalry),
          archers: parseNumber(current.archers),
        },
        target: {
          infantry: parseNumber(target.infantry, true),
          cavalry: parseNumber(target.cavalry, true),
          archers: parseNumber(target.archers, true),
        },
      }),
    [capacity, current, target],
  );

  function applyPreset(key: string) {
    const p = REFILL_PRESETS[key];
    if (!p) return;
    setPreset(key);
    setTarget({ infantry: String(p.infantry), cavalry: String(p.cavalry), archers: String(p.archers) });
  }

  const labelFor = (type: TroopType) => dict[`tools.refill.${type}`];

  return (
    <section className="card p-5 md:p-6" aria-labelledby="refill-title">
      <header className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Swords className="size-6" aria-hidden />
        </span>
        <div>
          <h2 id="refill-title" className="text-xl font-extrabold text-ink">{dict["tools.refill.title"]}</h2>
          <p className="mt-1 text-sm text-ink-muted">{dict["tools.refill.description"]}</p>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Inputs */}
        <div className="space-y-5">
          <NumberField label={dict["tools.refill.capacity"]} value={capacity} onChange={setCapacity} />

          <fieldset>
            <legend className="label">{dict["tools.refill.inRally"]}</legend>
            <div className="grid grid-cols-3 gap-2">
              {TROOP_TYPES.map((type) => (
                <NumberField
                  key={type}
                  compact
                  label={`${TROOP_ICONS[type]} ${labelFor(type)}`}
                  value={current[type]}
                  onChange={(v) => setCurrent((c) => ({ ...c, [type]: v }))}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">{dict["tools.refill.target"]}</legend>
            <div className="grid grid-cols-3 gap-2">
              {TROOP_TYPES.map((type) => (
                <NumberField
                  key={type}
                  compact
                  decimals
                  suffix="%"
                  label={`${TROOP_ICONS[type]} ${labelFor(type)}`}
                  value={target[type]}
                  onChange={(v) => {
                    setPreset(null);
                    setTarget((t) => ({ ...t, [type]: v }));
                  }}
                />
              ))}
            </div>
            <p className="mt-3 text-xs font-bold text-ink-muted">{dict["tools.refill.presets"]}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PRESET_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className={clsx(
                    "chip border px-3 py-1.5 transition-colors",
                    preset === key
                      ? "border-primary bg-primary text-primary-ink"
                      : "border-line bg-card-soft text-ink-muted hover:border-primary hover:text-ink",
                  )}
                >
                  {dict[`tools.refill.preset.${key}`]}
                  <span className="tabular opacity-70" dir="ltr">
                    {REFILL_PRESETS[key].infantry}/{REFILL_PRESETS[key].cavalry}/{REFILL_PRESETS[key].archers}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {result.invalidRatio && <Warning>{dict["tools.refill.ratioSumWarning"]}</Warning>}
          {result.full && !result.invalidRatio && <Warning>{dict["tools.refill.fullWarning"]}</Warning>}
          {result.overTarget && !result.full && !result.invalidRatio && <Warning>{dict["tools.refill.overTargetWarning"]}</Warning>}

          <div className="grid grid-cols-2 gap-2">
            <Stat label={dict["tools.refill.remaining"]} value={nf.format(result.remaining)} />
            <Stat label={dict["tools.refill.toSend"]} value={nf.format(result.totalToSend)} highlight />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-primary-soft text-xs font-extrabold tracking-wide text-ink-muted uppercase">
                <tr>
                  <th className="px-3 py-2 text-start">{dict["tools.refill.type"]}</th>
                  <th className="px-3 py-2 text-end">{dict["tools.refill.current"]}</th>
                  <th className="px-3 py-2 text-end">{dict["tools.refill.targetCount"]}</th>
                  <th className="px-3 py-2 text-end">{dict["tools.refill.toSend"]}</th>
                  <th className="hidden px-3 py-2 text-end sm:table-cell">{dict["tools.refill.after"]}</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {result.rows.map((row) => (
                  <tr key={row.type} className="border-t border-line">
                    <td className="px-3 py-2.5 font-bold text-ink">
                      <span aria-hidden>{TROOP_ICONS[row.type]}</span> {labelFor(row.type)}
                    </td>
                    <td className="px-3 py-2.5 text-end text-ink-muted" suppressHydrationWarning>
                      {nf.format(row.current)}
                    </td>
                    <td className="px-3 py-2.5 text-end text-ink-muted" suppressHydrationWarning>
                      {nf.format(row.targetCount)}
                    </td>
                    <td className={clsx("px-3 py-2.5 text-end font-black", row.toSend > 0 ? "text-primary" : "text-ink-faint")} suppressHydrationWarning>
                      {row.toSend > 0 ? `+${nf.format(row.toSend)}` : "0"}
                    </td>
                    <td className="hidden px-3 py-2.5 text-end text-ink sm:table-cell" suppressHydrationWarning>
                      {nf.format(row.after)}{" "}
                      <span className="text-xs text-ink-faint" suppressHydrationWarning>
                        ({pf.format(row.afterPercent)}%)
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-line bg-card-soft font-extrabold">
                  <td className="px-3 py-2.5 text-ink">{dict["tools.refill.total"]}</td>
                  <td className="px-3 py-2.5 text-end text-ink" suppressHydrationWarning>
                    {nf.format(result.deployed)}
                  </td>
                  <td className="px-3 py-2.5 text-end text-ink" suppressHydrationWarning>
                    {nf.format(result.rows.reduce((a, r) => a + r.targetCount, 0))}
                  </td>
                  <td className="px-3 py-2.5 text-end text-primary" suppressHydrationWarning>
                    +{nf.format(result.totalToSend)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-end text-ink sm:table-cell" suppressHydrationWarning>
                    {nf.format(result.deployed + result.totalToSend)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Visual ratio bar: after refill */}
          <RatioBar rows={result.rows} labelFor={labelFor} pf={pf} />
        </div>
      </div>
    </section>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-gold-soft px-4 py-3 text-sm font-bold text-gold-ink">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold-strong" aria-hidden />
      {children}
    </p>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={clsx("rounded-2xl px-4 py-3", highlight ? "bg-primary text-primary-ink" : "bg-card-soft text-ink")}>
      <p className={clsx("text-xs font-bold", highlight ? "text-primary-ink/80" : "text-ink-muted")}>{label}</p>
      <p className="text-2xl/tight font-black tabular" suppressHydrationWarning>
        {value}
      </p>
    </div>
  );
}

const BAR_COLORS: Record<TroopType, string> = {
  infantry: "bg-sky-400",
  cavalry: "bg-amber-400",
  archers: "bg-emerald-400",
};

function RatioBar({
  rows,
  labelFor,
  pf,
}: {
  rows: Array<{ type: TroopType; afterPercent: number }>;
  labelFor: (type: TroopType) => string;
  pf: Intl.NumberFormat;
}) {
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-card-soft" dir="ltr" aria-hidden>
        {rows.map((row) => (
          <div key={row.type} className={clsx("transition-all", BAR_COLORS[row.type])} style={{ width: `${row.afterPercent}%` }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-ink-muted">
        {rows.map((row) => (
          <li key={row.type} className="inline-flex items-center gap-1.5">
            <span className={clsx("size-2.5 rounded-full", BAR_COLORS[row.type])} aria-hidden />
            {labelFor(row.type)}{" "}
            <span className="text-ink tabular" suppressHydrationWarning>
              {pf.format(row.afterPercent)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
