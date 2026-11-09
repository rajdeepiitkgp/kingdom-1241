// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * Numbers as players type them into the calculators, in their own language's
 * notation (pure, unit-tested): a German "2.500" is two and a half thousand
 * and "2,5" two and a half; in English it is the other way round. Spaces and
 * other grouping marks are ignored. Arabic-Indic digits read like Western
 * ones, and the Arabic marks need no guessing: ٫ is always the decimal mark
 * and ٬ always groups thousands.
 */

const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g;

export interface NumberSeparators {
  decimal: "." | ",";
  group: "." | "," | " ";
}

/** The decimal and grouping marks of a language, from Intl; English's when the runtime doesn't know the language. */
export function numberSeparators(locale: string): NumberSeparators {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
    const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
    const group = parts.find((part) => part.type === "group")?.value ?? ",";
    return { decimal: decimal === "," ? "," : ".", group: group === "." ? "." : group === "," ? "," : " " };
  } catch {
    return { decimal: ".", group: "," };
  }
}

/**
 * The number in a typed string (0 when empty or hopeless). Whole numbers keep
 * only their digits. With `decimals`, a mark followed by one or two digits is
 * the decimal mark, a mark that appears more than once groups thousands, and a
 * single mark followed by exactly three digits is read as the language writes
 * it ("2.500" groups in German, in English it is a decimal). When both marks
 * appear, the last one is the decimal mark.
 */
export function parseLocalizedNumber(value: string, locale: string, decimals = false): number {
  const western = value
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) & 0xf))
    .replace(/٬/g, "")
    .replace(/٫/g, ".");
  if (!decimals) {
    const n = Number(western.replace(/[^\d-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  const cleaned = western.replace(/[^\d.,-]/g, "");
  const dots = cleaned.split(".").length - 1;
  const commas = cleaned.split(",").length - 1;
  let decimal: "." | "," | null = null;
  if (dots > 0 && commas > 0) decimal = cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",") ? "." : ",";
  else if (dots + commas === 1) {
    const mark = dots === 1 ? "." : ",";
    const digitsAfter = cleaned.length - cleaned.lastIndexOf(mark) - 1;
    decimal = digitsAfter === 3 ? (numberSeparators(locale).decimal === mark ? mark : null) : mark;
  }
  const plain = decimal === "." ? cleaned.replace(/,/g, "") : decimal === "," ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/[.,]/g, "");
  const n = Number(plain);
  return Number.isFinite(n) ? n : 0;
}
