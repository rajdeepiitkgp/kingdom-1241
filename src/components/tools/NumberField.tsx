// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { useId } from "react";

/**
 * Numeric text field that tolerates thousands separators and keeps the raw
 * string in state so typing feels natural on phones.
 */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  step,
  decimals = false,
  className,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  min?: number;
  step?: number;
  decimals?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={clsx("label", compact && "mb-1 text-xs")}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode={decimals ? "decimal" : "numeric"}
          autoComplete="off"
          value={value}
          min={min}
          step={step}
          onChange={(event) => onChange(event.target.value)}
          className={clsx("input", compact && "px-3 py-2 text-sm", suffix && "pe-12")}
          dir="ltr"
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 inset-e-3 flex items-center text-sm font-bold text-ink-faint">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/** Parse "1,500,000" / "1 500 000" / "1.5" into a number (0 when empty/invalid). */
export function parseNumber(value: string, decimals = false): number {
  const cleaned = decimals ? value.replace(/[^\d.,-]/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "") : value.replace(/[^\d-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
