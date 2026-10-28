/**
 * Settings made of whole numbers, each with a default and bounds (pure,
 * unit-tested): the owner's wrong-password rules and feedback defaults. A
 * stored value is read tolerantly (anything missing or malformed takes its
 * default, everything stays within its bounds); the settings form strictly.
 */

export interface NumberField {
  min: number;
  max: number;
  default: number;
}

export type NumberSchema<K extends string> = Record<K, NumberField>;

export function numberDefaults<K extends string>(schema: NumberSchema<K>): Record<K, number> {
  return Object.fromEntries(Object.entries<NumberField>(schema).map(([key, field]) => [key, field.default])) as Record<K, number>;
}

export function parseNumbers<K extends string>(schema: NumberSchema<K>, value: unknown): Record<K, number> {
  const stored = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries<NumberField>(schema).map(([key, field]) => {
      const n = stored[key];
      return [key, Math.min(field.max, Math.max(field.min, typeof n === "number" && Number.isInteger(n) ? n : field.default))];
    }),
  ) as Record<K, number>;
}

export type NumberFormResult<K extends string> = { ok: true; value: Record<K, number> } | { ok: false; errors: Record<string, string> };

/** The form's fields are named like the schema's keys. */
export function parseNumberForm<K extends string>(schema: NumberSchema<K>, form: { get(name: string): unknown }): NumberFormResult<K> {
  const errors: Record<string, string> = {};
  const value = {} as Record<K, number>;
  for (const [key, field] of Object.entries<NumberField>(schema) as Array<[K, NumberField]>) {
    const raw = form.get(key);
    const n = typeof raw === "string" && /^\d{1,6}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
    if (Number.isInteger(n) && n >= field.min && n <= field.max) value[key] = n;
    else errors[key] = `${field.min} to ${field.max}.`;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}
